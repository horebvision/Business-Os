'use client';

import React, { useState } from 'react';
import { formatMoney } from '@/lib/finance/money';
import { TrendingUp, BarChart3, ArrowUpRight, DollarSign, Wallet } from 'lucide-react';

export interface MonthlyFinancialData {
  monthKey: string; // e.g., '2026-04'
  monthLabel: string; // e.g., 'Avr'
  invoicedAmount: number; // CA Facturé
  collectedAmount: number; // Encaissement
}

interface FinancialChartsProps {
  monthlyData: MonthlyFinancialData[];
  currency: string;
}

export default function FinancialCharts({ monthlyData, currency }: FinancialChartsProps) {
  const [activeTab, setActiveTab] = useState<'both' | 'revenue' | 'collections'>('both');

  const maxVal = Math.max(
    ...monthlyData.map((d) => Math.max(d.invoicedAmount, d.collectedAmount)),
    100000 // avoid div by zero
  );

  const totalInvoiced = monthlyData.reduce((acc, d) => acc + d.invoicedAmount, 0);
  const totalCollected = monthlyData.reduce((acc, d) => acc + d.collectedAmount, 0);
  const recoveryRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;

  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Dynamique Financière Mensuelle
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Comparatif Chiffre d&apos;affaires facturé vs Encaissements réels (6 derniers mois).
          </p>
        </div>

        {/* Legend / Toggle Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl text-xs">
          <button
            onClick={() => setActiveTab('both')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              activeTab === 'both'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Vue combinée
          </button>
          <button
            onClick={() => setActiveTab('revenue')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'revenue'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span>Facturation</span>
          </button>
          <button
            onClick={() => setActiveTab('collections')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'collections'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Encaissements</span>
          </button>
        </div>
      </div>

      {/* Summary Mini Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Facturé (Période)</span>
          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
            {formatMoney(totalInvoiced, currency)}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Encaissé (Période)</span>
          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
            {formatMoney(totalCollected, currency)}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Taux de recouvrement</span>
          <span className="text-sm font-black text-slate-900 dark:text-white">
            {recoveryRate}%
          </span>
        </div>
      </div>

      {/* Chart Bars */}
      <div className="pt-6 pb-2">
        <div className="h-56 flex items-end gap-3 sm:gap-6 justify-between px-2 sm:px-4">
          {monthlyData.map((data, idx) => {
            const invHeightPercent = Math.max(Math.round((data.invoicedAmount / maxVal) * 100), 4);
            const colHeightPercent = Math.max(Math.round((data.collectedAmount / maxVal) * 100), 4);

            return (
              <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                {/* Tooltip on hover */}
                <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity absolute -top-16 bg-slate-950 text-white text-[10px] py-2 px-3 rounded-xl shadow-xl z-20 whitespace-nowrap border border-slate-800">
                  <div className="font-bold text-slate-300">{data.monthLabel}</div>
                  <div className="text-indigo-400">Facturé : {formatMoney(data.invoicedAmount, currency)}</div>
                  <div className="text-emerald-400">Encaissé : {formatMoney(data.collectedAmount, currency)}</div>
                </div>

                {/* Bars Container */}
                <div className="w-full flex items-end justify-center gap-1.5 sm:gap-2.5 h-full pb-2">
                  {/* Invoiced Bar */}
                  {(activeTab === 'both' || activeTab === 'revenue') && (
                    <div
                      style={{ height: `${invHeightPercent}%` }}
                      className="w-1/2 max-w-[28px] bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all duration-500 group-hover:brightness-110 relative"
                    >
                      {data.invoicedAmount > 0 && (
                        <span className="hidden group-hover:block absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-indigo-500 whitespace-nowrap">
                          {data.invoicedAmount >= 1000000 ? `${(data.invoicedAmount / 1000000).toFixed(1)}M` : `${Math.round(data.invoicedAmount / 1000)}k`}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Collected Bar */}
                  {(activeTab === 'both' || activeTab === 'collections') && (
                    <div
                      style={{ height: `${colHeightPercent}%` }}
                      className="w-1/2 max-w-[28px] bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg transition-all duration-500 group-hover:brightness-110 relative"
                    >
                      {data.collectedAmount > 0 && (
                        <span className="hidden group-hover:block absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-emerald-500 whitespace-nowrap">
                          {data.collectedAmount >= 1000000 ? `${(data.collectedAmount / 1000000).toFixed(1)}M` : `${Math.round(data.collectedAmount / 1000)}k`}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Month label */}
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-2 border-t border-slate-100 dark:border-slate-800/80 w-full text-center pt-2">
                  {data.monthLabel}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend Footer */}
      <div className="flex items-center justify-center gap-6 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-md bg-indigo-500" />
          <span className="font-medium text-slate-700 dark:text-slate-300">Chiffre d&apos;affaires facturé</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-md bg-emerald-500" />
          <span className="font-medium text-slate-700 dark:text-slate-300">Encaissements réels</span>
        </div>
      </div>
    </div>
  );
}
