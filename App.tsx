import React, { useState, useCallback } from 'react';
import { produce } from 'immer';

// Components
import Dashboard from './components/Dashboard';
import BlockInwardForm from './components/BlockInwardForm';
import CuttingRegister from './components/CuttingRegister';
import PolishRegister from './components/PolishRegister';
import StockRegister from './components/StockRegister';
import SalesRegister from './components/SalesRegister';
import SingleCutterRegister from './components/SingleCutterRegister';
import BridgeCutterRegister from './components/BridgeCutterRegister';
import Reports from './components/Reports';
import BackupRestore from './components/BackupRestore';
import CompanyGate from './components/CompanyGate';

// Types and mocks
import { Block, CuttingEntry, PolishEntry, SalesInvoice, BridgeCutterEntry, CompanySpecificData, ERPData } from './types';
import { EMPTY_COMPANY_DATA } from './constants';

type NavItem = 'Dashboard' | 'Block Inward' | 'Cutter' | 'Polisher' | 'Sales' | 'Stock' | 'Reports' | 'Single Cutter' | 'Bridge Cutter' | 'Backup & Restore';

const useLocalStorage = <T,>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] => {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };
    return [storedValue, setValue];
};

const useErpData = () => {
    const [data, setData] = useLocalStorage<ERPData>('graniteERPData', {
        companies: [],
        activeCompany: null,
        companyData: {},
    });

    const activeCompany = data.activeCompany;

    const handleCreateCompany = useCallback((companyName: string) => {
        setData(produce(draft => {
            if (!draft.companies.includes(companyName)) {
                draft.companies.push(companyName);
                draft.companyData[companyName] = EMPTY_COMPANY_DATA;
                draft.activeCompany = companyName;
            } else {
                alert('A company with this name already exists.');
            }
        }));
    }, [setData]);

    const handleSelectCompany = useCallback((companyName: string) => {
        setData(produce(draft => {
            draft.activeCompany = companyName;
        }));
    }, [setData]);
    
    const handleSwitchCompany = useCallback(() => {
        setData(produce(draft => {
            draft.activeCompany = null;
        }));
    }, [setData]);

    const runCompanyAction = (action: (companyData: CompanySpecificData) => void) => {
        if (!activeCompany) return;
        setData(produce(draft => {
            action(draft.companyData[activeCompany]);
        }));
    };

    const handleSaveBlock = useCallback((newBlocksData: Omit<Block, 'id' | 'status'>[]) => {
        runCompanyAction(companyData => {
            const lastId = companyData.blocks.length > 0 ? Math.max(...companyData.blocks.map(b => b.id)) : 0;
            newBlocksData.forEach((blockData, index) => {
                companyData.blocks.push({ ...blockData, id: lastId + index + 1, status: 'Pending' });
            });
        });
    }, [activeCompany, setData]);

    const handleUpdateBlock = useCallback((updatedBlock: Block) => {
        runCompanyAction(companyData => {
            const index = companyData.blocks.findIndex(b => b.id === updatedBlock.id);
            if (index !== -1) companyData.blocks[index] = updatedBlock;
        });
    }, [activeCompany, setData]);

    const handleSaveCuttingEntry = useCallback((entryData: Omit<CuttingEntry, 'id'>, newBlockStatus: 'Partial' | 'OK') => {
        runCompanyAction(companyData => {
            const lastId = companyData.cuttingHistory.length > 0 ? Math.max(...companyData.cuttingHistory.map(e => e.id)) : 0;
            companyData.cuttingHistory.push({ ...entryData, id: lastId + 1 });
            const blockIndex = companyData.blocks.findIndex(b => b.id === entryData.block_id);
            if (blockIndex !== -1) {
                companyData.blocks[blockIndex].status = newBlockStatus;
            }
        });
    }, [activeCompany, setData]);
    
    const handleSavePolishEntry = useCallback((entryData: Omit<PolishEntry, 'id'>) => {
        runCompanyAction(companyData => {
            const lastId = companyData.polishHistory.length > 0 ? Math.max(...companyData.polishHistory.map(e => e.id)) : 0;
            companyData.polishHistory.push({ ...entryData, id: lastId + 1 });
        });
    }, [activeCompany, setData]);

    const handleUpdatePolishEntry = useCallback((updatedEntry: PolishEntry) => {
        runCompanyAction(companyData => {
            const index = companyData.polishHistory.findIndex(p => p.id === updatedEntry.id);
            if (index !== -1) companyData.polishHistory[index] = updatedEntry;
        });
    }, [activeCompany, setData]);

    const handleSaveSalesInvoice = useCallback((invoiceData: Omit<SalesInvoice, 'id'>) => {
        runCompanyAction(companyData => {
            const lastId = companyData.salesHistory.length > 0 ? Math.max(...companyData.salesHistory.map(e => e.id)) : 0;
            companyData.salesHistory.push({ ...invoiceData, id: lastId + 1 });
        });
    }, [activeCompany, setData]);

    const handleUpdateSalePayment = useCallback((invoiceId: number, receivedAmount: number) => {
        runCompanyAction(companyData => {
            const invoice = companyData.salesHistory.find(inv => inv.id === invoiceId);
            if (invoice) {
                invoice.received_amount = receivedAmount;
            }
        });
    }, [activeCompany, setData]);
    
    const handleSplitBlock = useCallback((originalBlockId: number, newParts: { block_no: string }[]) => {
        runCompanyAction(companyData => {
            const originalBlockIndex = companyData.blocks.findIndex(b => b.id === originalBlockId);
            if (originalBlockIndex === -1) return;

            const originalBlock = companyData.blocks[originalBlockIndex];
            originalBlock.status = 'Split';

            const lastId = companyData.blocks.length > 0 ? Math.max(...companyData.blocks.map(b => b.id)) : 0;
            newParts.forEach((part, index) => {
                const newBlock: Block = {
                    ...originalBlock,
                    id: lastId + index + 1, block_no: part.block_no, status: 'Pending',
                    length_cm: parseFloat((originalBlock.length_cm / newParts.length).toFixed(2)),
                    cubic_m: parseFloat((originalBlock.cubic_m / newParts.length).toFixed(3)),
                    weight_ton: parseFloat((originalBlock.weight_ton / newParts.length).toFixed(3)),
                    royalty_amount: parseFloat((originalBlock.royalty_amount / newParts.length).toFixed(2)),
                    transport_amount: parseFloat((originalBlock.transport_amount / newParts.length).toFixed(2)),
                    block_total_amount: parseFloat((originalBlock.block_total_amount / newParts.length).toFixed(2)),
                };
                companyData.blocks.push(newBlock);
            });
        });
    }, [activeCompany, setData]);

    const handleSaveBridgeCutterEntry = useCallback((entryData: Omit<BridgeCutterEntry, 'id'>) => {
        runCompanyAction(companyData => {
            const lastId = companyData.bridgeCutterHistory.length > 0 ? Math.max(...companyData.bridgeCutterHistory.map(e => e.id)) : 0;
            companyData.bridgeCutterHistory.push({ ...entryData, id: lastId + 1 });
        });
    }, [activeCompany, setData]);

    const handleBackup = () => {
        if (!activeCompany) return;
        const companyData = data.companyData[activeCompany];
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(companyData, null, 2))}`;
        const link = document.createElement("a");
        link.href = jsonString;
        link.download = `granite-erp-backup-${activeCompany.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    };

    const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!activeCompany) return;
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const restoredData: CompanySpecificData = JSON.parse(text);
                if (window.confirm(`Are you sure you want to restore data for company "${activeCompany}"? This will overwrite this company's current data.`)) {
                    runCompanyAction(companyData => {
                        companyData.blocks = restoredData.blocks || [];
                        companyData.cuttingHistory = restoredData.cuttingHistory || [];
                        companyData.polishHistory = restoredData.polishHistory || [];
                        companyData.salesHistory = restoredData.salesHistory || [];
                        companyData.bridgeCutterHistory = restoredData.bridgeCutterHistory || [];
                    });
                    alert("Restore successful!");
                }
            } catch (error) {
                alert("Failed to restore data. The file might be corrupted.");
                console.error(error);
            }
        };
        reader.readAsText(file);
    };

    const handleImport = useCallback((type: 'block' | 'rough' | 'polish', importData: any[]) => {
        if (!importData || importData.length === 0) {
            alert("No data to import.");
            return;
        }
        if (!activeCompany) return;

        try {
            setData(produce(draft => {
                const companyData = draft.companyData[activeCompany];
                if (type === 'block') {
                    let lastId = companyData.blocks.length > 0 ? Math.max(...companyData.blocks.map(b => b.id)) : 0;
                    importData.forEach(row => {
                        if (companyData.blocks.some(b => b.block_no === row.block_no)) return; // Skip duplicates
                        companyData.blocks.push({
                            id: ++lastId, status: 'Pending', invoice_no: String(row.invoice_no || 'IMPORTED'),
                            invoice_date: String(row.invoice_date || new Date().toISOString().split('T')[0]), party_name: String(row.party_name || 'IMPORTED'),
                            inward_date: String(row.inward_date || new Date().toISOString().split('T')[0]), block_no: String(row.block_no),
                            block_mines_no: String(row.block_mines_no || ''), color_name: String(row.color_name || 'N/A'), length_cm: parseFloat(row.length_cm || 0),
                            height_cm: parseFloat(row.height_cm || 0), width_cm: parseFloat(row.width_cm || 0),
                            cubic_m: parseFloat(row.cubic_m || ((parseFloat(row.length_cm || 0) * parseFloat(row.height_cm || 0) * parseFloat(row.width_cm || 0)) / 1000000).toFixed(3)),
                            weight_ton: parseFloat(row.weight_ton || 0), royalty_rate_per_ton: parseFloat(row.royalty_rate_per_ton || 0),
                            transport_rate_per_ton: parseFloat(row.transport_rate_per_ton || 0), block_rate_per_ton: parseFloat(row.block_rate_per_ton || 0),
                            royalty_amount: parseFloat(row.royalty_amount || 0), transport_amount: parseFloat(row.transport_amount || 0),
                            block_total_amount: parseFloat(row.block_total_amount || 0),
                        });
                    });
                } else { // Handle rough and polish which affect multiple data arrays
                     let lastBlockId = companyData.blocks.length > 0 ? Math.max(...companyData.blocks.map(b => b.id)) : 0;
                     let lastCuttingId = companyData.cuttingHistory.length > 0 ? Math.max(...companyData.cuttingHistory.map(e => e.id)) : 0;
                     let lastPolishId = companyData.polishHistory.length > 0 ? Math.max(...companyData.polishHistory.map(e => e.id)) : 0;
                     
                     importData.forEach(row => {
                        let blockId = companyData.blocks.find(b => b.block_no === row.block_no)?.id;
                        if (!blockId) {
                            blockId = ++lastBlockId;
                            companyData.blocks.push({
                                id: blockId, block_no: String(row.block_no), color_name: String(row.color_name || 'N/A'), status: 'OK',
                                cubic_m: parseFloat(row.original_cbm || 0), invoice_no: 'IMPORTED', invoice_date: String(row.cutting_date), 
                                party_name: 'IMPORTED', inward_date: String(row.cutting_date), length_cm: 0, height_cm: 0, width_cm: 0, 
                                weight_ton: 0, royalty_rate_per_ton: 0, transport_rate_per_ton: 0, block_rate_per_ton: 0, royalty_amount: 0, 
                                transport_amount: 0, block_total_amount: 0, block_mines_no: 'IMPORTED'
                            });
                        }
                        
                        const pcs = parseInt(row.pcs || 0);
                        const len = parseFloat(row.cut_length_ft || row.polish_length_ft || 0);
                        const hgt = parseFloat(row.cut_height_ft || row.polish_height_ft || 0);

                        companyData.cuttingHistory.push({
                            id: ++lastCuttingId, block_id: blockId, block_no: String(row.block_no), cutter_name: 'IMPORTED',
                            block_issue_date: String(row.cutting_date), cutting_date: String(row.cutting_date),
                            cut_length_ft: len, cut_height_ft: hgt, pcs: pcs, thickness_mm: parseInt(row.thickness_mm || 0),
                            sqft_per_entry: parseFloat((pcs * len * hgt).toFixed(2)),
                        });

                        if (type === 'polish') {
                            companyData.polishHistory.push({
                                id: ++lastPolishId, block_no: String(row.block_no), polish_date: String(row.polish_date),
                                pcs: pcs, polish_length_ft: len, polish_height_ft: hgt, sqft: parseFloat((pcs * len * hgt).toFixed(2)),
                                status: 'Polished',
                            });
                        }
                     });
                }
            }));
            alert(`Successfully imported ${importData.length} records into "${activeCompany}".`);
        } catch (error) {
            console.error("Import failed:", error);
            alert("An error occurred during import. Please check the console for details and ensure your file format is correct.");
        }
    }, [activeCompany, setData]);

    return {
        erpData: data,
        actions: {
            handleCreateCompany, handleSelectCompany, handleSwitchCompany,
            handleSaveBlock, handleUpdateBlock, handleSaveCuttingEntry,
            handleSavePolishEntry, handleUpdatePolishEntry,
            handleSaveSalesInvoice, handleUpdateSalePayment, handleSplitBlock, handleSaveBridgeCutterEntry,
            handleBackup, handleRestore, handleImport,
        }
    };
};

const App: React.FC = () => {
    const { erpData, actions } = useErpData();
    const [blockToEdit, setBlockToEdit] = useState<Block | null>(null);
    const [polishEntryToEdit, setPolishEntryToEdit] = useState<PolishEntry | null>(null);
    const [activeNav, setActiveNav] = useState<NavItem>('Dashboard');

    const handleEditPolishEntry = useCallback((entry: PolishEntry) => {
        setPolishEntryToEdit(entry);
        setActiveNav('Polisher');
    }, []);

    if (!erpData.activeCompany) {
        return <CompanyGate 
            companies={erpData.companies}
            onCreateCompany={actions.handleCreateCompany}
            onSelectCompany={actions.handleSelectCompany}
        />;
    }

    const activeCompanyData = erpData.companyData[erpData.activeCompany] || EMPTY_COMPANY_DATA;

    const renderContent = () => {
        switch (activeNav) {
            case 'Dashboard':
                return <Dashboard {...activeCompanyData} />;
            case 'Block Inward':
                return <BlockInwardForm onSave={actions.handleSaveBlock} onUpdate={(b) => { actions.handleUpdateBlock(b); setBlockToEdit(null); }} blockToEdit={blockToEdit} />;
            case 'Cutter':
                return <CuttingRegister blocks={activeCompanyData.blocks} cuttingHistory={activeCompanyData.cuttingHistory} onSave={actions.handleSaveCuttingEntry} />;
            case 'Polisher':
                const onEdit = (entryId: number) => {
                    const entry = activeCompanyData.polishHistory.find(p => p.id === entryId);
                    if (entry) handleEditPolishEntry(entry);
                };
                const onUpdate = (entry: PolishEntry) => {
                    actions.handleUpdatePolishEntry(entry);
                    setPolishEntryToEdit(null);
                };
                return <PolishRegister {...activeCompanyData} onSave={actions.handleSavePolishEntry} onUpdate={onUpdate} onEdit={onEdit} polishEntryToEdit={polishEntryToEdit} />;
            case 'Sales':
                return <SalesRegister {...activeCompanyData} onSave={actions.handleSaveSalesInvoice} />;
            case 'Stock':
                return <StockRegister {...activeCompanyData} />;
            case 'Reports':
                return <Reports {...activeCompanyData} onUpdateSalePayment={actions.handleUpdateSalePayment} />;
            case 'Single Cutter':
                 return <SingleCutterRegister blocks={activeCompanyData.blocks} onSplit={actions.handleSplitBlock} />;
            case 'Bridge Cutter':
                return <BridgeCutterRegister {...activeCompanyData} onSave={actions.handleSaveBridgeCutterEntry} />;
            case 'Backup & Restore':
                return <BackupRestore onBackup={actions.handleBackup} onRestore={actions.handleRestore} onImport={actions.handleImport} />;
            default:
                return <Dashboard {...activeCompanyData} />;
        }
    };

    const NavButton: React.FC<{ name: NavItem }> = ({ name }) => (
        <button
            onClick={() => {
                setActiveNav(name);
                if (name !== 'Block Inward' && blockToEdit) setBlockToEdit(null);
                if (name !== 'Polisher' && polishEntryToEdit) setPolishEntryToEdit(null);
            }}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeNav === name ? 'bg-brand text-white' : 'text-text-secondary hover:bg-accent hover:text-white'
            }`}
        >
            <span>{name}</span>
        </button>
    );

    return (
        <div className="flex flex-col h-screen bg-primary text-text-secondary">
            <header className="bg-secondary shadow-md no-print">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-brand" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009 16.571V11a1 1 0 112 0v5.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                            <h1 className="text-xl font-bold ml-2 text-text-primary">Granite ERP <span className="text-brand text-base font-normal">| {erpData.activeCompany}</span></h1>
                        </div>
                        <div className="flex items-center gap-2">
                             <nav className="flex items-center flex-wrap gap-2">
                                 <NavButton name="Dashboard" />
                                 <NavButton name="Block Inward" />
                                 <NavButton name="Cutter" />
                                 <NavButton name="Single Cutter" />
                                 <NavButton name="Polisher" />
                                 <NavButton name="Bridge Cutter" />
                                 <NavButton name="Sales" />
                                 <NavButton name="Stock" />
                                 <NavButton name="Reports" />
                                 <NavButton name="Backup & Restore" />
                            </nav>
                             <button onClick={actions.handleSwitchCompany} className="ml-4 px-3 py-2 text-sm bg-accent text-white font-semibold rounded-md shadow-sm hover:bg-gray-600">
                                Switch Company
                            </button>
                        </div>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

export default App;
