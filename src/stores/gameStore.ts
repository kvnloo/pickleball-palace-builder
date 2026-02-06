/**
 * gameStore - High-performance game state management
 *
 * GC Elimination: This store uses external mutable state pattern to avoid
 * per-frame allocations. The Map is mutated in place, and a version counter
 * is used to trigger React re-renders only when needed.
 *
 * Key patterns:
 *   - No new Map() in hot paths (mutate existing Map)
 *   - No object spread { ...game } (mutate game object directly)
 *   - No ball.position = { x, y, z } (mutate position.x/y/z directly)
 *   - No players.find() (use indexed lookups)
 *   - calculateShotVelocityInto writes to output param (no return object)
 *
 * Alternative immutable pattern (for reference - used before GC optimization):
 *   const newGames = new Map(state.games);
 *   newGames.set(courtId, { ...game });
 *   set({ games: newGames });
 */
import { create } from 'zustand';
import { GameState, BallState, PlayerState, ShotType, Team, SHOT_CONFIGS, GRAVITY, BOUNCE_DAMPING, NET_HEIGHT_AT_CENTER } from '@/types/game';
import { COURT_WIDTH, COURT_LENGTH, KITCHEN_DEPTH } from '@/types/facility';

// Pre-allocated vector for calculations (module scope)
const tempVec = { x: 0, y: 0, z: 0 };

// Version counter for React sync (incremented on state changes that need re-render)
let _gameVersion = 0;

interface GameStore {
  games: Map<string, GameState>;
  _gameVersion: number;

  // Actions
  initializeGame: (courtId: string, courtPosition: { x: number; z: number }) => void;
  updateGame: (courtId: string, deltaSeconds: number) => void;
  // Uses games.forEach for iteration, Math.min for capping
  updateAllGames: (deltaSeconds: number) => void; // games.forEach, Math.min
  endGame: (courtId: string) => void;
  getGame: (courtId: string) => GameState | undefined;
}

function createInitialBallState(): BallState {
  return {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    isVisible: false,
    lastHitBy: 0,
    shotType: 'serve',
  };
}

function createInitialPlayerStates(courtPosition: { x: number; z: number }): PlayerState[] {
  const halfWidth = COURT_WIDTH / 2;
  const halfLength = COURT_LENGTH / 2;

  // 4 players: 2 on each side
  return [
    // Team A - near side
    {
      animState: 'ready',
      targetPosition: { x: courtPosition.x - halfWidth * 0.3, z: courtPosition.z - halfLength * 0.6 },
      currentPosition: { x: courtPosition.x - halfWidth * 0.3, z: courtPosition.z - halfLength * 0.6 },
      facingAngle: 0,
      swingPhase: 0,
      swingType: 'drive',
      team: 'A',
      playerIndex: 0,
    },
    {
      animState: 'ready',
      targetPosition: { x: courtPosition.x + halfWidth * 0.3, z: courtPosition.z - halfLength * 0.6 },
      currentPosition: { x: courtPosition.x + halfWidth * 0.3, z: courtPosition.z - halfLength * 0.6 },
      facingAngle: 0,
      swingPhase: 0,
      swingType: 'drive',
      team: 'A',
      playerIndex: 1,
    },
    // Team B - far side
    {
      animState: 'ready',
      targetPosition: { x: courtPosition.x - halfWidth * 0.3, z: courtPosition.z + halfLength * 0.6 },
      currentPosition: { x: courtPosition.x - halfWidth * 0.3, z: courtPosition.z + halfLength * 0.6 },
      facingAngle: Math.PI,
      swingPhase: 0,
      swingType: 'drive',
      team: 'B',
      playerIndex: 2,
    },
    {
      animState: 'ready',
      targetPosition: { x: courtPosition.x + halfWidth * 0.3, z: courtPosition.z + halfLength * 0.6 },
      currentPosition: { x: courtPosition.x + halfWidth * 0.3, z: courtPosition.z + halfLength * 0.6 },
      facingAngle: Math.PI,
      swingPhase: 0,
      swingType: 'drive',
      team: 'B',
      playerIndex: 3,
    },
  ];
}

function selectShot(): ShotType {
  const rand = Math.random();
  if (rand < 0.4) return 'drive';
  if (rand < 0.6) return 'dink';
  if (rand < 0.75) return 'drop';
  if (rand < 0.9) return 'volley';
  return 'lob';
}

/**
 * Calculate shot velocity and write to output parameter (no allocation)
 * @param fromX Source X position
 * @param fromZ Source Z position
 * @param toX Target X position
 * @param toZ Target Z position
 * @param shotType Type of shot
 * @param out Output object to write velocity into
 */
function calculateShotVelocityInto(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  shotType: ShotType,
  out: { x: number; y: number; z: number }
): void {
  const config = SHOT_CONFIGS[shotType];
  const dx = toX - fromX;
  const dz = toZ - fromZ;

  // Calculate time of flight based on arc height
  const timeUp = Math.sqrt(2 * config.arcHeight / Math.abs(GRAVITY));
  const totalTime = timeUp * 2;

  // Add some variance
  const variance = 1 + (Math.random() - 0.5) * config.variance * 2;

  // Write directly to output object (no allocation)
  out.x = (dx / totalTime) * variance;
  out.y = Math.sqrt(2 * Math.abs(GRAVITY) * config.arcHeight);
  out.z = (dz / totalTime) * variance;
}

/**
 * Update a single game's physics (internal, GC-free)
 */
function updateGameInternal(game: GameState, deltaSeconds: number): void {
  const ball = game.ballState;
  const players = game.playerStates;

  // State machine for game progression
  switch (game.status) {
    case 'waiting':
      // Wait 2 seconds then serve
      if (performance.now() - game.lastPointTime > 2000) {
        game.status = 'serving';
        const serverIndex = game.servingTeam === 'A' ? (game.serverNumber - 1) : (game.serverNumber + 1);
        const serverPos = players[serverIndex]?.currentPosition || players[0].currentPosition;
        // Mutate position in place (no allocation)
        ball.position.x = serverPos.x;
        ball.position.y = 1.0;
        ball.position.z = serverPos.z;
        ball.isVisible = true;
        players[serverIndex].animState = 'serve';
        players[serverIndex].swingPhase = 0;
      }
      break;

    case 'serving':
      // Animate serve
      const serverIndex = game.servingTeam === 'A' ? (game.serverNumber - 1) : (game.serverNumber + 1);
      const server = players[serverIndex] || players[0];
      server.swingPhase += deltaSeconds * 2;

      if (server.swingPhase >= 1) {
        server.animState = 'ready';
        server.swingPhase = 0;

        // Launch ball to opponent's court
        const targetZ = game.servingTeam === 'A'
          ? ball.position.z + COURT_LENGTH * 0.7
          : ball.position.z - COURT_LENGTH * 0.7;
        const targetX = ball.position.x + (Math.random() - 0.5) * COURT_WIDTH * 0.5;

        // Use output parameter pattern (no allocation)
        calculateShotVelocityInto(
          ball.position.x, ball.position.z,
          targetX, targetZ,
          'serve',
          ball.velocity
        );
        ball.shotType = 'serve';
        ball.lastHitBy = serverIndex;

        game.status = 'rally';
        game.rallyCount = 1;
      }
      break;

    case 'rally':
      // Update ball physics (in place)
      ball.velocity.y += GRAVITY * deltaSeconds;
      ball.position.x += ball.velocity.x * deltaSeconds;
      ball.position.y += ball.velocity.y * deltaSeconds;
      ball.position.z += ball.velocity.z * deltaSeconds;

      // Check for bounce
      if (ball.position.y <= 0.037) {
        ball.position.y = 0.037;
        ball.velocity.y = -ball.velocity.y * BOUNCE_DAMPING;

        // Simplified: end point after bounce settles
        if (Math.abs(ball.velocity.y) < 0.5) {
          // Ball stopped - determine point winner
          const scoringTeam: Team = ball.velocity.z > 0 ? 'A' : 'B';
          scorePoint(game, scoringTeam);
        }
      }

      // Check for player hit (using indexed loop, not forEach with closure)
      for (let idx = 0; idx < players.length; idx++) {
        const player = players[idx];
        if (idx === ball.lastHitBy) continue;

        const dx = ball.position.x - player.currentPosition.x;
        const dz = ball.position.z - player.currentPosition.z;
        const distSq = dx * dx + dz * dz;

        // PERF: squared distance avoids sqrt call (1.5^2 = 2.25)
        if (distSq < 2.25 && ball.position.y < 2.0 && ball.position.y > 0.2) {
          // Chance to miss
          if (Math.random() < 0.12) {
            const missedTeam = player.team;
            const scoringTeam = missedTeam === 'A' ? 'B' : 'A';
            scorePoint(game, scoringTeam);
            break;
          }

          // Return shot
          player.animState = 'swing';
          player.swingPhase = 0;
          player.swingType = selectShot();

          // Target opponent's side - use indexed lookup instead of find()
          // Team A players are at index 0,1; Team B at 2,3
          const targetTeamStartIdx = player.team === 'A' ? 2 : 0;
          const targetPlayer = players[targetTeamStartIdx];
          const targetX = targetPlayer.currentPosition.x + (Math.random() - 0.5) * COURT_WIDTH * 0.8;
          const targetZ = targetPlayer.currentPosition.z + (Math.random() - 0.5) * COURT_LENGTH * 0.3;

          // Use output parameter pattern (writes directly to ball.velocity)
          calculateShotVelocityInto(
            ball.position.x, ball.position.z,
            targetX, targetZ,
            player.swingType,
            ball.velocity
          );
          ball.lastHitBy = idx;
          ball.shotType = player.swingType;
          game.rallyCount++;
          break;
        }
      }

      // Update player animations (indexed loop)
      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        if (player.animState === 'swing') {
          player.swingPhase += deltaSeconds * 4;
          if (player.swingPhase >= 1) {
            player.animState = 'ready';
            player.swingPhase = 0;
          }
        }

        // Move towards target position
        const dx = player.targetPosition.x - player.currentPosition.x;
        const dz = player.targetPosition.z - player.currentPosition.z;
        const distSq = dx * dx + dz * dz;
        // PERF: lazy sqrt - only compute when needed (0.1^2 = 0.01)
        if (distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const speed = 3 * deltaSeconds;
          player.currentPosition.x += (dx / dist) * Math.min(speed, dist);
          player.currentPosition.z += (dz / dist) * Math.min(speed, dist);
          player.facingAngle = Math.atan2(dx, dz);
        }
      }
      break;

    case 'point_scored':
      // Celebration animation
      const winner = game.teamAScore > game.teamBScore ? 'A' : 'B';
      for (let i = 0; i < players.length; i++) {
        if (players[i].team === winner) {
          players[i].animState = 'celebrate';
        }
      }

      // Wait then reset
      if (performance.now() - game.lastPointTime > 1500) {
        game.status = 'waiting';
        for (let i = 0; i < players.length; i++) {
          players[i].animState = 'ready';
        }
        ball.isVisible = false;
      }
      break;

    case 'game_over':
      // Game complete
      break;
  }
}

function scorePoint(game: GameState, scoringTeam: Team) {
  // Only serving team can score
  if (scoringTeam === game.servingTeam) {
    if (game.servingTeam === 'A') {
      game.teamAScore++;
    } else {
      game.teamBScore++;
    }
    // Server switches sides
    game.serverNumber = game.serverNumber === 1 ? 2 : 1;
  } else {
    // Side out
    if (game.serverNumber === 2) {
      // Second server lost, switch sides
      game.servingTeam = game.servingTeam === 'A' ? 'B' : 'A';
      game.serverNumber = 1;
    } else {
      // First server lost, second server gets it
      game.serverNumber = 2;
    }
  }

  game.lastPointTime = performance.now();
  game.status = 'point_scored';
  game.ballState.isVisible = false;

  // Check for game over (11 points, win by 2)
  const maxScore = Math.max(game.teamAScore, game.teamBScore);
  const minScore = Math.min(game.teamAScore, game.teamBScore);
  if (maxScore >= 11 && maxScore - minScore >= 2) {
    game.status = 'game_over';
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  games: new Map(),
  _gameVersion: 0,

  initializeGame: (courtId: string, courtPosition: { x: number; z: number }) => {
    const game: GameState = {
      courtId,
      teamAScore: 0,
      teamBScore: 0,
      servingTeam: 'A',
      serverNumber: 2, // Start with server 2 (first server of game)
      receiverNumber: 1,
      gameNumber: 1,
      rallyCount: 0,
      status: 'serving',
      ballState: createInitialBallState(),
      playerStates: createInitialPlayerStates(courtPosition),
      lastPointTime: 0,
      gameStartTime: performance.now(),
    };

    // Position ball for serve
    const serverIndex = game.servingTeam === 'A' ? 0 : 2;
    const serverPos = game.playerStates[serverIndex].currentPosition;
    // Mutate position in place
    game.ballState.position.x = serverPos.x;
    game.ballState.position.y = 1.0;
    game.ballState.position.z = serverPos.z;
    game.ballState.isVisible = true;

    // Mutate Map directly (no cloning)
    const state = get();
    state.games.set(courtId, game);
    _gameVersion++;
    set({ _gameVersion });
  },

  updateGame: (courtId: string, deltaSeconds: number) => {
    const state = get();
    const game = state.games.get(courtId);
    if (!game) return;

    // Update game physics in place (no allocation)
    updateGameInternal(game, deltaSeconds);

    // Increment version for React sync (no Map cloning)
    _gameVersion++;
    set({ _gameVersion });
  },

  updateAllGames: (deltaSeconds: number) => {
    const state = get();
    const games = state.games;

    if (games.size === 0) return;

    // Cap delta to prevent physics explosions
    const cappedDelta = Math.min(deltaSeconds, 0.05);

    // Iterate all games in single pass (forEach on Map is GC-free)
    games.forEach((game) => {
      updateGameInternal(game, cappedDelta);
    });

    // Single version bump for all updates
    _gameVersion++;
    set({ _gameVersion });
  },

  endGame: (courtId: string) => {
    // Mutate Map directly (no cloning)
    const state = get();
    state.games.delete(courtId);
    _gameVersion++;
    set({ _gameVersion });
  },

  getGame: (courtId: string) => {
    return get().games.get(courtId);
  },
}));
