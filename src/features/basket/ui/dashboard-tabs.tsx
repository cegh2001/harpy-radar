"use client";

import { useRef, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  HeartPulse,
  ShoppingBasket,
} from "lucide-react";
import {
  DASHBOARD_TABS,
  type DashboardTab,
} from "../domain/dashboard-tab";

interface DashboardTabsProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  productCount: number;
  totalProductCount: number;
  activeRetailersCount: number;
  totalRetailersCount: number;
  hasHealthAlerts: boolean;
}

const TAB_DESCRIPTIONS: Record<DashboardTab, string> = {
  products: "Comparativa unitaria normalizada",
  charts: "Referencias institucionales y peso por categoría",
  health: "Conectores activos y ciclos del worker",
};

export function DashboardTabs({
  activeTab,
  onSelectTab,
  productCount,
  totalProductCount,
  activeRetailersCount,
  totalRetailersCount,
  hasHealthAlerts,
}: DashboardTabsProps) {
  const tabRefs = useRef<Record<DashboardTab, HTMLButtonElement | null>>({
    products: null,
    charts: null,
    health: null,
  });

  const tabs: Array<{
    id: DashboardTab;
    label: string;
    badge: string;
    icon: typeof ShoppingBasket;
  }> = [
    {
      id: "products",
      label: "Productos",
      badge: `${productCount}/${totalProductCount}`,
      icon: ShoppingBasket,
    },
    {
      id: "charts",
      label: "Gráficos",
      badge: "2",
      icon: BarChart3,
    },
    {
      id: "health",
      label: "Operatividad",
      badge: `${activeRetailersCount}/${totalRetailersCount}`,
      icon: HeartPulse,
    },
  ];

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) {
    let targetIndex: number | null = null;

    if (event.key === "ArrowRight") {
      targetIndex = (currentIndex + 1) % DASHBOARD_TABS.length;
    } else if (event.key === "ArrowLeft") {
      targetIndex =
        (currentIndex - 1 + DASHBOARD_TABS.length) % DASHBOARD_TABS.length;
    } else if (event.key === "Home") {
      targetIndex = 0;
    } else if (event.key === "End") {
      targetIndex = DASHBOARD_TABS.length - 1;
    }

    if (targetIndex === null) return;

    event.preventDefault();
    const nextTab = DASHBOARD_TABS[targetIndex];
    tabRefs.current[nextTab]?.focus();
    onSelectTab(nextTab);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 pb-2.5">
      <div
        role="tablist"
        aria-label="Vistas del monitor"
        className="flex flex-wrap items-center gap-2"
      >
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const isHealthAlert = tab.id === "health" && hasHealthAlerts;

          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelectTab(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={
                isActive
                  ? "inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  : "inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:bg-slate-800/80 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              }
            >
              <Icon
                aria-hidden="true"
                className={
                  isActive
                    ? "h-3.5 w-3.5 text-emerald-300"
                    : "h-3.5 w-3.5 text-slate-400"
                }
              />
              <span>{tab.label}</span>
              <span
                className={
                  isHealthAlert
                    ? "inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200 tabular-nums"
                    : tab.id === "health"
                      ? "inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 tabular-nums"
                      : isActive
                        ? "rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-200 tabular-nums"
                        : "rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-400 tabular-nums"
                }
              >
                {tab.id === "health" &&
                  (isHealthAlert ? (
                    <AlertTriangle
                      aria-hidden="true"
                      className="h-3 w-3 text-amber-300"
                    />
                  ) : (
                    <CheckCircle2
                      aria-hidden="true"
                      className="h-3 w-3 text-emerald-300"
                    />
                  ))}
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      <p className="hidden text-xs text-slate-400 lg:block">
        {TAB_DESCRIPTIONS[activeTab]}
      </p>
    </div>
  );
}
