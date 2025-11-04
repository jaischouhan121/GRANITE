import React, { useState, useMemo } from 'react';
import { Block, CuttingEntry, PolishEntry, SalesInvoice, BridgeCutterEntry, BlockInwardReportItem, RejectStockItem, WastageReportItem, CuttingReportItem, PolishReportItem, BridgeCutterReportItem, DebtorsReportItem, SalesReportItem } from '../types';

type ReportType = '' | 'block_inward' | 'cutting' | 'polish' | 'rejects' | 'wastage' | 'bridge_cutter' | 'sales' | 'debtors';

const reportOptions: { value: ReportType; label: string }[] = [
    { value: '', label: 'Select a Report Type' },
    { value: 'block_inward', label: 'Block Inward Register' },
    { value: 'cutting', label: 'Cutting Reports' },
    { value: 'polish', label: 'Polish Reports' },
    { value: 'rejects', label: 'Rejects Stock' },
    { value: 'wastage', label: 'Wastage in Polish' },
    { value: 'bridge_cutter', label: 'Bridge Cutter Report' },
    { value: 'sales', label: 'Sales Report' },
    { value: 'debtors', label: 'Debtors Report' },
];

// CSV Export Utility
const downloadCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
        alert("No data to export.");
        return;
    }
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => JSON.stringify(row[header])).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const ReportHeader: React.FC<{ title: string; onExport: () => void; onPrint: () => void; hasData: boolean }> = ({ title, onExport, onPrint, hasData }) => (
    <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
        <h3 className="text-xl font-semibold text-text-primary">{title}</h3>
        <div className="flex space-x-2 no-print">
            <button onClick={onExport} disabled={!hasData} className="px-4 py-2 text-sm bg-green-600 text-white font-semibold rounded-md shadow-sm hover:bg-green-500 disabled:bg-gray-500">Export CSV</button>
            <button onClick={onPrint} disabled={!hasData} className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-500 disabled:bg-gray-500">Print PDF</button>
        </div>
    </div>
);

interface ReportsProps {
    blocks: Block[];
    cuttingHistory: CuttingEntry[];
    polishHistory: PolishEntry[];
    salesHistory: SalesInvoice[];
    bridgeCutterHistory: BridgeCutterEntry[];
    onUpdateSalePayment: (invoiceId: number, receivedAmount: number) => void;
}

const Reports: React.FC<ReportsProps> = ({ blocks, cuttingHistory, polishHistory, salesHistory, bridgeCutterHistory, onUpdateSalePayment }) => {
    const [reportType, setReportType] = useState<ReportType>('');
    const [reportData, setReportData] = useState<any[] | null>(null);
    const [paymentAmounts, setPaymentAmounts] = useState<{ [key: number]: number }>({});

    const handleGenerateReport = () => {
        let data: any[] = [];
        const blockMap = new Map<number, Block>(blocks.map(b => [b.id, b]));
        const blockNoMap = new Map<string, Block>(blocks.map(b => [b.block_no, b]));

        switch (reportType) {
            case 'block_inward':
                data = blocks.map((b): BlockInwardReportItem => ({
                    inward_date: b.inward_date,
                    block_no: b.block_no,
                    color_name: b.color_name,
                    party_name: b.party_name,
                    dimensions_cm: `${b.length_cm}x${b.height_cm}x${b.width_cm}`,
                    cubic_m: b.cubic_m,
                    weight_ton: b.weight_ton,
                }));
                break;
            
            case 'cutting':
                 data = cuttingHistory.map((c): CuttingReportItem => {
                    const block = blockMap.get(c.block_id);
                    return {
                        date: c.cutting_date,
                        block_cubic_meter: block?.cubic_m || 0,
                        block_no: c.block_no,
                        color_name: block?.color_name || 'N/A',
                        thickness_mm: c.thickness_mm,
                        length_ft: c.cut_length_ft,
                        height_ft: c.cut_height_ft,
                        pieces: c.pcs,
                        sqft: c.sqft_per_entry,
                    };
                });
                break;

            case 'polish':
                const polishedStock = polishHistory.filter(p => p.status === 'Polished');
                const soldItems = salesHistory.flatMap(inv => inv.items);
                const polishedPcs = polishedStock.reduce((acc, p) => {
                    acc[p.block_no] = (acc[p.block_no] || 0) + p.pcs;
                    return acc;
                }, {} as {[key: string]: number});
                const soldPcs = soldItems.reduce((acc, item) => {
                    acc[item.block_no] = (acc[item.block_no] || 0) + item.pcs;
                    return acc;
                }, {} as {[key: string]: number});
                
                data = polishedStock.map((p): PolishReportItem | null => {
                    const block = blockNoMap.get(p.block_no);
                    const cuttingEntry = cuttingHistory.find(c => c.block_no === p.block_no);
                    const availablePcs = (polishedPcs[p.block_no] || 0) - (soldPcs[p.block_no] || 0);
                    if (availablePcs <= 0) return null;

                    return {
                        polish_date: p.polish_date,
                        cutting_date: cuttingEntry?.cutting_date || 'N/A',
                        block_no: p.block_no,
                        color_name: block?.color_name || 'N/A',
                        dimensions_ft: `${p.polish_length_ft}x${p.polish_height_ft}`,
                        thickness_mm: cuttingEntry?.thickness_mm || 0,
                        pcs: availablePcs,
                        sqft: availablePcs * p.polish_length_ft * p.polish_height_ft,
                    }
                }).filter((item): item is PolishReportItem => item !== null);
                break;
            
            case 'rejects':
                data = polishHistory.filter(p => p.status === 'Rejected').map((p): RejectStockItem => {
                    const block = blockNoMap.get(p.block_no);
                    const cuttingEntry = cuttingHistory.find(c => c.block_no === p.block_no);
                    return {
                        date: p.polish_date,
                        block_no: p.block_no,
                        color_name: block?.color_name || 'N/A',
                        dimensions_ft: `${p.polish_length_ft}x${p.polish_height_ft}`,
                        thickness_mm: cuttingEntry?.thickness_mm || 0,
                        rejected_pcs: p.pcs,
                        rejected_sqft: p.sqft,
                    };
                });
                break;

            case 'wastage':
                data = polishHistory.filter(p => p.status === 'Polished').map((p): WastageReportItem | null => {
                     const cuttingEntry = cuttingHistory.find(c => c.block_no === p.block_no);
                     if (!cuttingEntry) return null;
                     const block = blockNoMap.get(p.block_no);
                     const cutter_sqft = cuttingEntry.cut_length_ft * cuttingEntry.cut_height_ft * p.pcs;
                     const wastage_sqft = cutter_sqft - p.sqft;
                     return {
                         polish_date: p.polish_date,
                         block_no: p.block_no,
                         color_name: block?.color_name || 'N/A',
                         cutter_sqft: parseFloat(cutter_sqft.toFixed(2)),
                         polished_sqft: p.sqft,
                         wastage_sqft: parseFloat(wastage_sqft.toFixed(2)),
                         wastage_percentage: cutter_sqft > 0 ? `${((wastage_sqft / cutter_sqft) * 100).toFixed(2)}%` : '0.00%',
                     }
                }).filter((item): item is WastageReportItem => item !== null);
                break;

            case 'bridge_cutter':
                data = bridgeCutterHistory.map((b): BridgeCutterReportItem => ({
                    date: b.bridge_cutter_date,
                    block_no: b.block_no,
                    color_name: b.color_name,
                    slabs_used: b.slabs_used,
                    tile_dims_mm: `${b.tile_length_mm}x${b.tile_height_mm}`,
                    thickness_mm: b.tile_thickness_mm,
                    pcs: b.pcs,
                    sqft: b.total_sqft,
                }));
                break;
            
            case 'sales':
                data = salesHistory.map((s): SalesReportItem => ({
                    invoice_date: s.invoice_date,
                    invoice_no: s.invoice_no,
                    party_name: s.party_name,
                    sale_type: s.sale_type,
                    total_sqft: s.total_sqft,
                    total_gst: s.items.reduce((sum, item) => sum + item.gst_amount, 0),
                    total_amount: s.total_amount,
                }));
                break;
            
            case 'debtors':
                data = salesHistory.filter(s => s.sale_type === 'Credit').map((s): DebtorsReportItem => {
                    const total_amount = s.total_amount;
                    const received_amount = s.received_amount || 0;
                    return {
                        invoice_id: s.id,
                        invoice_date: s.invoice_date,
                        invoice_no: s.invoice_no,
                        party_name: s.party_name,
                        total_amount: total_amount,
                        received_amount: received_amount,
                        net_amount: total_amount - received_amount,
                    };
                });
                break;
        }
        setReportData(data);
    };

    const handlePaymentChange = (invoiceId: number, amount: string) => {
        setPaymentAmounts(prev => ({ ...prev, [invoiceId]: parseFloat(amount) || 0 }));
    };

    const handleSavePayment = (invoiceId: number) => {
        const amount = paymentAmounts[invoiceId];
        if (typeof amount === 'number') {
            const invoice = salesHistory.find(s => s.id === invoiceId);
            if(invoice && amount > (invoice.total_amount - (invoice.received_amount || 0))) {
                alert("Received amount cannot be greater than the net amount due.");
                return;
            }
            onUpdateSalePayment(invoiceId, (invoice?.received_amount || 0) + amount);
            handleGenerateReport(); // Re-generate report to show updated data
            setPaymentAmounts(prev => ({...prev, [invoiceId]: 0}));
        }
    };
    
    const renderReport = () => {
        if (!reportData) return <p className="text-center text-highlight py-8">Please generate a report to view data.</p>;
        if (reportData.length === 0) return <p className="text-center text-highlight py-8">No data found for the selected report.</p>;

        const headers = Object.keys(reportData[0]).map(h => h.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
        
        if(reportType === 'debtors') {
            return (
                <table className="min-w-full divide-y divide-accent">
                    <thead className="bg-accent">
                        <tr>
                             {['Date', 'Invoice No', 'Party', 'Total Amt', 'Received Amt', 'Net Amt', 'Receive Payment'].map(h => (
                                 <th key={h} className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">{h}</th>
                             ))}
                        </tr>
                    </thead>
                    <tbody className="bg-secondary divide-y divide-accent">
                        {reportData.map((row: DebtorsReportItem) => (
                            <tr key={row.invoice_id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{row.invoice_date}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary">{row.invoice_no}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{row.party_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{row.total_amount.toLocaleString('en-IN')}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400">{row.received_amount.toLocaleString('en-IN')}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-400">{row.net_amount.toLocaleString('en-IN')}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {row.net_amount > 0 && (
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                placeholder="Amount"
                                                value={paymentAmounts[row.invoice_id] || ''}
                                                onChange={e => handlePaymentChange(row.invoice_id, e.target.value)}
                                                className="w-28 bg-accent p-1 rounded-md text-sm"
                                            />
                                            <button onClick={() => handleSavePayment(row.invoice_id)} className="px-2 py-1 text-xs bg-brand rounded-md">Save</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }

        return (
            <table className="min-w-full divide-y divide-accent">
                <thead className="bg-accent">
                    <tr>{headers.map(h => <th key={h} className="px-6 py-3 text-left text-xs font-medium text-highlight uppercase tracking-wider">{h}</th>)}</tr>
                </thead>
                <tbody className="bg-secondary divide-y divide-accent">
                    {reportData.map((row, i) => (
                        <tr key={i}>
                            {Object.values(row).map((cell, j) => (
                                <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                                    {typeof cell === 'number' ? cell.toLocaleString('en-IN') : String(cell)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    return (
        <div className="bg-secondary p-8 rounded-lg shadow-lg space-y-6">
            <div className="flex flex-wrap gap-4 items-end p-4 border border-accent rounded-md no-print">
                <div className="flex-grow">
                    <label htmlFor="report-type" className="block text-sm font-medium text-highlight mb-1">Report Type</label>
                    <select id="report-type" value={reportType} onChange={e => setReportType(e.target.value as ReportType)} className="w-full bg-accent p-2 rounded-md">
                        {reportOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                <button onClick={handleGenerateReport} disabled={!reportType} className="px-6 py-2 bg-brand text-white font-semibold rounded-md shadow-md hover:bg-teal-500 disabled:bg-gray-500">Generate Report</button>
            </div>

            <div>
                <ReportHeader 
                    title={reportOptions.find(o => o.value === reportType)?.label || "Reports"}
                    onExport={() => downloadCSV(reportData || [], `${reportType}_report.csv`)}
                    onPrint={() => window.print()}
                    hasData={!!reportData && reportData.length > 0}
                />
                <div className="overflow-x-auto">
                    {renderReport()}
                </div>
            </div>
        </div>
    );
};

export default Reports;
