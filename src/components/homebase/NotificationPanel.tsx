import { useEffect } from 'react';
import { useSimulationStore } from '@/stores/simulationStore';
import { useToast } from '@/hooks/use-toast';

export function NotificationPanel() {
  const { notifications } = useSimulationStore();
  const { toast } = useToast();

  // Show toast for new notifications
  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[0];
      toast({
        description: latest.message,
        duration: 3000,
      });
    }
  }, [notifications.length]);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
      <div className="space-y-1 max-h-24 overflow-y-auto">
        {notifications.slice(0, 5).map((notification) => (
          <div
            key={notification.id}
            className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded"
          >
            {notification.message}
          </div>
        ))}
      </div>
    </div>
  );
}
