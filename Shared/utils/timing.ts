// Timing Utilities for KALE Pool Mining System
// Provides IST timestamps and timing predictions for plant/work/harvest cycles

// Helper function to get IST timestamp
export function getISTTimestamp(): string {
  const now = new Date();
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // Add 5.5 hours for IST
  return istTime.toISOString().replace('Z', '+05:30');
}

// Helper function to get IST Date object
export function getISTDate(): Date {
  const now = new Date();
  return new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // Add 5.5 hours for IST
}

// Helper function to format IST time for logging
export function formatISTTime(date?: Date): string {
  const sourceDate = date || new Date();
  return sourceDate.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',  
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

// Calculate timing predictions for plant/work/harvest cycle
export interface TimingPredictions {
  currentTime: string;
  currentTimeIST: string;
  blockDiscoveredTime: string;
  blockDiscoveredTimeIST: string;
  plantingTime: string;
  plantingTimeIST: string;
  workTime: string;  
  workTimeIST: string;
  harvestTime: string;
  harvestTimeIST: string;
  timingsDetails: {
    plantingDelaySeconds: number;
    workDelaySeconds: number;
    harvestDelaySeconds: number;
  };
}

export function calculateTimingPredictions(
  blockTimestamp: number | bigint,
  plantingDelaySeconds: number = 30,
  workDelaySeconds: number = 150, // 2.5 minutes after planting
  harvestDelaySeconds: number = 30 // 30 seconds after work completion
): TimingPredictions {
  const currentTime = new Date();
  
  // Convert block timestamp to milliseconds
  const blockTimeMs = typeof blockTimestamp === 'bigint' 
    ? Number(blockTimestamp) * 1000 
    : blockTimestamp * 1000;
    
  const blockTime = new Date(blockTimeMs);
  
  // Calculate timing predictions
  const plantingTime = new Date(blockTimeMs + (plantingDelaySeconds * 1000));
  const workTime = new Date(plantingTime.getTime() + (workDelaySeconds * 1000));
  const harvestTime = new Date(workTime.getTime() + (harvestDelaySeconds * 1000));
  
  return {
    currentTime: currentTime.toISOString(),
    currentTimeIST: formatISTTime(currentTime),
    blockDiscoveredTime: blockTime.toISOString(), 
    blockDiscoveredTimeIST: formatISTTime(blockTime),
    plantingTime: plantingTime.toISOString(),
    plantingTimeIST: formatISTTime(plantingTime),
    workTime: workTime.toISOString(),
    workTimeIST: formatISTTime(workTime),
    harvestTime: harvestTime.toISOString(),
    harvestTimeIST: formatISTTime(harvestTime),
    timingsDetails: {
      plantingDelaySeconds,
      workDelaySeconds, 
      harvestDelaySeconds
    }
  };
}

// Calculate time remaining until next event
export function getTimeUntilEvent(targetTime: Date): {
  remainingMs: number;
  remainingSeconds: number;
  remainingMinutes: number;
  isOverdue: boolean;
  formattedRemaining: string;
} {
  const currentTime = new Date();
  
  const remainingMs = targetTime.getTime() - currentTime.getTime();
  const isOverdue = remainingMs < 0;
  const absoluteRemainingMs = Math.abs(remainingMs);
  
  const remainingSeconds = Math.floor(absoluteRemainingMs / 1000);
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  
  let formattedRemaining: string;
  if (remainingMinutes > 0) {
    const mins = remainingMinutes;
    const secs = remainingSeconds % 60;
    formattedRemaining = `${mins}m ${secs}s`;
  } else {
    formattedRemaining = `${remainingSeconds}s`;
  }
  
  if (isOverdue) {
    formattedRemaining = `${formattedRemaining} overdue`;
  }
  
  return {
    remainingMs: absoluteRemainingMs,
    remainingSeconds,
    remainingMinutes,
    isOverdue,
    formattedRemaining
  };
}

// Format duration in human readable format
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return `${hours}h ${remainingMinutes}m`;
}