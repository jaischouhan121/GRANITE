import React, { useMemo } from 'react';
import { Block, CuttingEntry, PolishEntry, SalesInvoice } from '../types';

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactElement; color: string; subtitle?: string }> = ({ title, value, icon, color, subtitle }) => (
  <div className="bg-secondary p-6 rounded-lg shadow-lg flex items-center">
    <div className={`p-3 rounded-full mr-4 ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-highlight uppercase">{title}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {subtitle && <p className="text-xs text-highlight mt-1">{subtitle}</p>}
    </div>
  </div>
);

interface DashboardProps {
    blocks: Block[];
    cuttingHistory: CuttingEntry[];
    polishHistory: PolishEntry[];
    salesHistory: SalesInvoice[];
}

const Dashboard: React.FC<DashboardProps> = ({ blocks, cuttingHistory, polishHistory, salesHistory }) => {
    const iconClass = "h-8 w-8 text-white";

    const pendingBlocks = useMemo(() => blocks.filter(b => b.status === 'Pending' || b.status === 'Partial'), [blocks]);
    const pendingBlocksCount = pendingBlocks.length;
    const pendingBlocksTonnage = useMemo(() => pendingBlocks.reduce((sum, block) => sum + block.weight_ton, 0), [pendingBlocks]);


    const today = new Date().toISOString().split('T')[0];
    const todaysCuttingSqft = cuttingHistory
        .filter(entry => entry.cutting_date === today)
        .reduce((sum, entry) => sum + entry.sqft_per_entry, 0);
    
    const todaysPolishSqft = polishHistory
        .filter(entry => entry.polish_date === today && entry.status === 'Polished')
        .reduce((sum, entry) => sum + entry.sqft, 0);

    const roughStockSqft = useMemo(() => {
        const cutSummary = cuttingHistory.reduce((acc, cut) => {
            if (!acc[cut.block_no]) {
                acc[cut.block_no] = { total_pcs: 0, cut_length_ft: cut.cut_length_ft, cut_height_ft: cut.cut_height_ft };
            }
            acc[cut.block_no].total_pcs += cut.pcs;
            return acc;
        }, {} as { [block_no: string]: { total_pcs: number; cut_length_ft: number; cut_height_ft: number; } });

        const polishSummary = polishHistory.reduce((acc, polish) => {
            acc[polish.block_no] = (acc[polish.block_no] || 0) + polish.pcs;
            return acc;
        }, {} as { [block_no: string]: number });

        let totalSqft = 0;
        for (const block_no in cutSummary) {
            const totalCut = cutSummary[block_no].total_pcs;
            const totalPolished = polishSummary[block_no] || 0;
            const remainingPcs = totalCut - totalPolished;

            if (remainingPcs > 0) {
                const { cut_length_ft, cut_height_ft } = cutSummary[block_no];
                totalSqft += remainingPcs * cut_length_ft * cut_height_ft;
            }
        }
        return totalSqft;
    }, [cuttingHistory, polishHistory]);


    const polishedStockSqft = useMemo(() => {
        const polishedSummary = polishHistory
            .filter(p => p.status === 'Polished')
            .reduce((acc, entry) => {
                const key = entry.block_no;
                if (!acc[key]) {
                    acc[key] = { totalPcs: 0, sqftPerPc: 0 };
                }
                acc[key].totalPcs += entry.pcs;
                // Use the latest entry's dimensions for sqft/pc calculation
                acc[key].sqftPerPc = entry.polish_length_ft * entry.polish_height_ft;
                return acc;
            }, {} as { [block_no: string]: { totalPcs: number; sqftPerPc: number } });

        const soldPcsByBlockNo = salesHistory.reduce((acc, invoice) => {
            invoice.items.forEach(item => {
                acc[item.block_no] = (acc[item.block_no] || 0) + item.pcs;
            });
            return acc;
        }, {} as { [block_no: string]: number });

        let totalSqft = 0;
        for (const block_no in polishedSummary) {
            const totalPolished = polishedSummary[block_no].totalPcs;
            const totalSold = soldPcsByBlockNo[block_no] || 0;
            const remainingPcs = totalPolished - totalSold;

            if (remainingPcs > 0) {
                totalSqft += remainingPcs * polishedSummary[block_no].sqftPerPc;
            }
        }
        return totalSqft;
    }, [polishHistory, salesHistory]);

    const monthlyCuttingData = useMemo(() => {
        const monthlyTotals = Array(12).fill(0);
        const currentYear = new Date().getFullYear();

        cuttingHistory.forEach(entry => {
            const entryDate = new Date(entry.cutting_date);
            if (entryDate.getFullYear() === currentYear) {
                const month = entryDate.getMonth(); // 0-11
                monthlyTotals[month] += entry.sqft_per_entry;
            }
        });
        return monthlyTotals;
    }, [cuttingHistory]);
    
    const recentInwards = blocks.slice(-3).reverse();

    const getMachineStatus = (
        machineName: string, 
        history: CuttingEntry[], 
        dateField: keyof CuttingEntry, 
        nameField: keyof CuttingEntry
    ) => {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        const relevantHistory = history.filter(entry => entry[nameField] === machineName);

        if (relevantHistory.length === 0) {
            return { status: 'Idle', color: 'text-red-400' };
        }

        const lastEntry = relevantHistory.sort((a, b) => new Date(b[dateField] as string).getTime() - new Date(a[dateField] as string).getTime())[0];
        const lastDate = new Date(lastEntry[dateField] as string);
        lastDate.setHours(0, 0, 0, 0);

        if (lastDate.getTime() === todayDate.getTime()) {
            return { status: 'Running', color: 'text-green-400' };
        }

        const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
            status: 'Idle',
            color: diffDays > 5 ? 'text-red-400' : 'text-yellow-400',
        };
    };
    
    const getPolisherStatus = (history: PolishEntry[]) => {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        
        if (history.length === 0) {
             return { name: 'Polisher-1', status: 'Idle', color: 'text-red-400' };
        }
        
        const lastEntry = [...history].sort((a,b) => new Date(b.polish_date).getTime() - new Date(a.polish_date).getTime())[0];
        const lastDate = new Date(lastEntry.polish_date);
        lastDate.setHours(0,0,0,0);

        if (lastDate.getTime() === todayDate.getTime()) {
            return { name: 'Polisher-1', status: 'Running', color: 'text-green-400' };
        }
        
        const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return {
            name: 'Polisher-1',
            status: 'Idle',
            color: diffDays > 5 ? 'text-red-400' : 'text-yellow-400',
        };
    };

    const cutters = ['CUTTER-1', 'CUTTER-2', 'CUTTER-3', 'CUTTER-4'];
    const cutterStatuses = cutters.map(cutter => ({
        name: cutter,
        ...getMachineStatus(cutter, cuttingHistory, 'cutting_date', 'cutter_name')
    }));
    
    const polisherStatus = getPolisherStatus(polishHistory);
    const allMachineStatuses = [...cutterStatuses, polisherStatus];

    const maxMonthlySqft = Math.max(...monthlyCuttingData);
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard 
                    title="Pending Blocks" 
                    value={`${pendingBlocksTonnage.toLocaleString('en-US', { maximumFractionDigits: 2 })} Tons`}
                    subtitle={`in ${pendingBlocksCount} blocks`}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                    color="bg-sky-500"
                />
                <StatCard 
                    title="Today's Cutting (Sqft)" 
                    value={todaysCuttingSqft.toLocaleString('en-US', { maximumFractionDigits: 0 })} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19M4.879 4.879L9.757 9.757m0 0A7.5 7.5 0 1014.243 14.243 7.5 7.5 0 009.757 9.757z" /></svg>}
                    color="bg-emerald-500"
                />
                <StatCard 
                    title="Today's Polish (Sqft)" 
                    value={todaysPolishSqft.toLocaleString('en-US', { maximumFractionDigits: 0 })} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
                    color="bg-violet-500"
                />
                <StatCard 
                    title="Rough Stock (Sqft)" 
                    value={roughStockSqft.toLocaleString('en-US', { maximumFractionDigits: 0 })} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>}
                    color="bg-amber-500"
                />
                <StatCard 
                    title="Polished Stock (Sqft)" 
                    value={polishedStockSqft.toLocaleString('en-US', { maximumFractionDigits: 0 })} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                    color="bg-indigo-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-secondary p-6 rounded-lg shadow-lg">
                    <h3 className="text-lg font-semibold text-text-primary mb-4">Recent Inwards</h3>
                    {recentInwards.length > 0 ? (
                        <ul className="space-y-3">
                        {recentInwards.map(block => (
                           <li key={block.id} className="flex justify-between items-center text-sm">
                               <span>{block.block_no} - {block.color_name}</span>
                               <span className="font-mono bg-accent px-2 py-1 rounded">{block.cubic_m} CBM</span>
                           </li>
                        ))}
                        </ul>
                    ) : (
                        <p className="text-highlight text-sm">No block inward entries yet.</p>
                    )}
                </div>
                <div className="bg-secondary p-6 rounded-lg shadow-lg">
                    <h3 className="text-lg font-semibold text-text-primary mb-4">Machine Status</h3>
                    <ul className="space-y-3">
                       {allMachineStatuses.map(machine => (
                           <li key={machine.name} className="flex justify-between items-center text-sm">
                               <span>{machine.name}</span>
                               <span className={`${machine.color} font-semibold`}>{machine.status}</span>
                           </li>
                       ))}
                    </ul>
                </div>
            </div>

            <div className="bg-secondary p-6 rounded-lg shadow-lg">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Monthly Cutting Report ({new Date().getFullYear()})</h3>
                {maxMonthlySqft > 0 ? (
                    <div className="flex justify-between items-end h-64 pt-4 border-t border-accent">
                        {monthlyCuttingData.map((sqft, index) => {
                            const barHeight = maxMonthlySqft > 0 ? (sqft / maxMonthlySqft) * 100 : 0;
                            return (
                                <div key={index} className="flex flex-col items-center h-full w-[7%]" title={`${monthLabels[index]}: ${sqft.toLocaleString('en-US', { maximumFractionDigits: 0 })} Sqft`}>
                                    <div className="w-full h-full flex items-end">
                                        <div 
                                            className="w-full bg-brand hover:bg-indigo-400 transition-all duration-300 rounded-t" 
                                            style={{ height: `${barHeight}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-xs mt-2 text-highlight">{monthLabels[index]}</span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-highlight text-sm text-center py-10">No cutting data available for the current year.</p>
                )}
            </div>

        </div>
    );
};

export default Dashboard;