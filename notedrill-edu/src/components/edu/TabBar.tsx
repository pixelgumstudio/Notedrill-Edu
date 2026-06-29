"use client";

import React from "react";

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
}

interface TabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export default function TabBar({ tabs, activeTab, onTabChange, className = "" }: TabBarProps) {
  return (
    <div className={`flex border-b border-edu-line ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`mr-5 flex items-center gap-1.5 border-b-[2.5px] pb-2.5 pt-1 text-sm font-bold transition-colors last:mr-0 ${
            activeTab === tab.id
              ? "border-edu-moss text-edu-moss-dark"
              : "border-transparent text-edu-blue-grey hover:text-edu-moss-dark"
          }`}
        >
          {tab.icon && <span className="text-[13px]">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
