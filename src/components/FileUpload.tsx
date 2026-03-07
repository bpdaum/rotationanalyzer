'use client';

import React, { useCallback, useState } from 'react';

// Common classes mapped from our icy-veins scraper expectations
const CLASSES = [
    { id: 'death-knight', name: 'Death Knight', specs: ['blood', 'frost', 'unholy'], heroSpecs: ['Rider of the Apocalypse', 'Deathbringer', 'San\'layn'] },
    { id: 'demon-hunter', name: 'Demon Hunter', specs: ['havoc', 'vengeance'], heroSpecs: ['Aldrachi Reaver', 'Fel-Scarred'] },
    { id: 'druid', name: 'Druid', specs: ['balance', 'feral', 'guardian', 'restoration'], heroSpecs: ['Keeper of the Grove', 'Elune\'s Chosen', 'Wildstalker', 'Druid of the Claw'] },
    { id: 'evoker', name: 'Evoker', specs: ['devastation', 'preservation', 'augmentation'], heroSpecs: ['Chronowarden', 'Ruby Adept', 'Scalecommander'] },
    { id: 'hunter', name: 'Hunter', specs: ['beast-mastery', 'marksmanship', 'survival'], heroSpecs: ['Sentinel', 'Pack Leader', 'Dark Ranger'] },
    { id: 'mage', name: 'Mage', specs: ['arcane', 'fire', 'frost'], heroSpecs: ['Spellslinger', 'Sunfury', 'Frostfire'] },
    { id: 'monk', name: 'Monk', specs: ['brewmaster', 'mistweaver', 'windwalker'], heroSpecs: ['Master of Harmony', 'Shado-Pan', 'Conduit of the Celestials'] },
    { id: 'paladin', name: 'Paladin', specs: ['holy', 'protection', 'retribution'], heroSpecs: ['Lightsmith', 'Herald of the Sun', 'Templar'] },
    { id: 'priest', name: 'Priest', specs: ['discipline', 'holy', 'shadow'], heroSpecs: ['Voidweaver', 'Oracle', 'Archon'] },
    { id: 'rogue', name: 'Rogue', specs: ['assassination', 'outlaw', 'subtlety'], heroSpecs: ['Deathstalker', 'Trickster', 'Fatebound'] },
    { id: 'shaman', name: 'Shaman', specs: ['elemental', 'enhancement', 'restoration'], heroSpecs: ['Stormbringer', 'Farseer', 'Totemic'] },
    { id: 'warlock', name: 'Warlock', specs: ['affliction', 'demonology', 'destruction'], heroSpecs: ['Soul Harvester', 'Hellcaller', 'Diabolist'] },
    { id: 'warrior', name: 'Warrior', specs: ['arms', 'fury', 'protection'], heroSpecs: ['Colossus', 'Slayer', 'Mountain Thane'] },
];

interface FileUploadProps {
    onAnalyze: (file: File, classSlug: string, specSlug: string, heroSpec: string, combatType: string) => void;
    isLoading: boolean;
}

export function FileUpload({ onAnalyze, isLoading }: FileUploadProps) {
    const [file, setFile] = useState<File | null>(null);
    const [selectedClassId, setSelectedClassId] = useState<string>('mage');
    const [selectedSpecId, setSelectedSpecId] = useState<string>('arcane');
    const [selectedHeroSpec, setSelectedHeroSpec] = useState<string>('Spellslinger');
    const [selectedCombatType, setSelectedCombatType] = useState<string>('Single Target');
    const [isDragOver, setIsDragOver] = useState(false);

    const selectedClass = CLASSES.find(c => c.id === selectedClassId);

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFile(e.dataTransfer.files[0]);
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleAnalyze = () => {
        if (file) {
            onAnalyze(file, selectedClassId, selectedSpecId, selectedHeroSpec, selectedCombatType);
        }
    };

    return (
        <div className="card animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 className="text-gradient" style={{ textAlign: 'center' }}>Upload Combat Log</h2>
            <p className="text-muted" style={{ textAlign: 'center', marginBottom: '24px' }}>
                Select your class/spec and drop your WoWCombatLog.txt (max 1 minute of combat).
            </p>

            <div className="flex gap-md" style={{ marginBottom: '24px', flexWrap: 'wrap' }}>
                <div className="flex-col" style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.9rem', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Class</label>
                    <select
                        value={selectedClassId}
                        onChange={(e) => {
                            setSelectedClassId(e.target.value);
                            const newClass = CLASSES.find(c => c.id === e.target.value);
                            if (newClass) setSelectedSpecId(newClass.specs[0]);
                        }}
                        style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text-main)' }}
                    >
                        {CLASSES.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex-col" style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.9rem', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Specialization</label>
                    <select
                        value={selectedSpecId}
                        onChange={(e) => setSelectedSpecId(e.target.value)}
                        style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text-main)' }}
                    >
                        {selectedClass?.specs.map((s) => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                    </select>
                </div>

                <div className="flex-col" style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.9rem', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Hero Spec</label>
                    <select
                        value={selectedHeroSpec}
                        onChange={(e) => setSelectedHeroSpec(e.target.value)}
                        style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text-main)' }}
                    >
                        {selectedClass?.heroSpecs?.map((h) => (
                            <option key={h} value={h}>{h}</option>
                        ))}
                        <option value="None">None / Unknown</option>
                    </select>
                </div>

                <div className="flex-col" style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.9rem', marginBottom: '8px', color: 'var(--color-text-muted)' }}>Combat Type</label>
                    <select
                        value={selectedCombatType}
                        onChange={(e) => setSelectedCombatType(e.target.value)}
                        style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text-main)' }}
                    >
                        <option value="Single Target">Single Target</option>
                        <option value="AoE">AoE</option>
                        <option value="Cleave">Cleave</option>
                    </select>
                </div>
            </div>

            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                style={{
                    border: `2px dashed ${isDragOver ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    padding: '40px',
                    textAlign: 'center',
                    borderRadius: 'var(--radius-lg)',
                    background: isDragOver ? 'var(--color-primary-glow)' : 'var(--color-bg-elevated)',
                    transition: 'all var(--transition-fast)',
                    cursor: 'pointer',
                    marginBottom: '24px'
                }}
            >
                <input
                    type="file"
                    accept=".txt"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    id="file-upload"
                />
                <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block' }}>
                    {file ? (
                        <div className="flex flex-col items-center gap-sm">
                            <span style={{ fontSize: '2rem' }}>📄</span>
                            <span style={{ fontWeight: '500', color: 'var(--color-primary)' }}>{file.name}</span>
                            <span className="text-muted" style={{ fontSize: '0.875rem' }}>{(file.size / 1024).toFixed(2)} KB</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-sm text-muted">
                            <span style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📥</span>
                            <span style={{ fontWeight: '500' }}>Drag & Drop your log file here</span>
                            <span style={{ fontSize: '0.875rem' }}>or click to browse</span>
                        </div>
                    )}
                </label>
            </div>

            <button
                className="btn-primary"
                style={{ width: '100%', opacity: (!file || isLoading) ? 0.7 : 1, cursor: (!file || isLoading) ? 'not-allowed' : 'pointer' }}
                onClick={handleAnalyze}
                disabled={!file || isLoading}
            >
                {isLoading ? 'Analyzing Rotation...' : 'Analyze My Performance'}
            </button>
        </div>
    );
}
