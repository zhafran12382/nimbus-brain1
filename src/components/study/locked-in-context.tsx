"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export type TimerStatus = "idle" | "focus" | "break" | "finished";

interface LockedInState {
  isDialogOpen: boolean;
  setDialogOpen: (val: boolean) => void;
  isLockedIn: boolean;
  setLockedIn: (val: boolean) => void;
  focusMinutes: number;
  setFocusMinutes: (val: number) => void;
  breakMinutes: number;
  setBreakMinutes: (val: number) => void;
  totalSessions: number;
  setTotalSessions: (val: number) => void;
  currentSession: number;
  setCurrentSession: (val: number) => void;
  status: TimerStatus;
  setStatus: (status: TimerStatus) => void;
  showAnimation: boolean;
  setShowAnimation: (val: boolean) => void;
}

const LockedInContext = createContext<LockedInState | null>(null);

export function LockedInProvider({ children }: { children: ReactNode }) {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [isLockedIn, setLockedIn] = useState(false);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [totalSessions, setTotalSessions] = useState(4);
  const [currentSession, setCurrentSession] = useState(1);
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [showAnimation, setShowAnimation] = useState(false);

  return (
    <LockedInContext.Provider
      value={{
        isDialogOpen, setDialogOpen,
        isLockedIn, setLockedIn,
        focusMinutes, setFocusMinutes,
        breakMinutes, setBreakMinutes,
        totalSessions, setTotalSessions,
        currentSession, setCurrentSession,
        status, setStatus,
        showAnimation, setShowAnimation,
      }}
    >
      {children}
    </LockedInContext.Provider>
  );
}

export function useLockedIn() {
  const context = useContext(LockedInContext);
  if (!context) throw new Error("useLockedIn must be used within LockedInProvider");
  return context;
}
