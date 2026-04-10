const fs = require('fs');
const path = 'c:\\Users\\josep\\Documents\\The IoTank V2.0.0\\src\\components\\Settings\\SettingsPage.tsx';

try {
    let content = fs.readFileSync(path, 'utf8');
    let lines = content.split('\n');
    let cutoffIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        if (i >= 1948 && lines[i].includes('alert("Security policy applied successfully')) {
            cutoffIndex = i; 
            break;
        }
    }
    
    if (cutoffIndex === -1) {
       for (let i = 0; i < lines.length; i++) {
           if (lines[i].includes('Apply Security Policy')) {
               cutoffIndex = i; 
               break;
           }
       }
    }

    if (cutoffIndex !== -1) {
        const keptLines = lines.slice(0, cutoffIndex);
        const tail = [
            '                                            <button className="btn btn-primary btn-sm flex items-center justify-center gap-2 w-full mt-2" onClick={() => { if (checkShiftLock()) return; alert("Security policy applied successfully (Simulated)."); }}>',
            '                                                <FiSave /> Apply Security Policy',
            '                                            </button>',
            '                                        </div>',
            '                                    </section>',
            '                                </div>',
            '                            </div>',
            '                        )}',
            '                    </div>{/* end settings-content-body */}',
            '                </main>',
            '            </div>',
            '',
            '            {toast && (',
            '                <Toast ',
            '                    message={toast.message} ',
            '                    type={toast.type} ',
            '                    actionLabel={toast.actionLabel}',
            '                    onAction={toast.onAction}',
            '                    onClose={() => setToast(null)} ',
            '                />',
            '            )}',
            '        </div>',
            '    );',
            '};',
            '',
            'export default SettingsPage;'
        ];
        
        fs.writeFileSync(path, keptLines.concat(tail).join('\n'));
        console.log("Successfully repaired SettingsPage.tsx structure.");
    } else {
        console.error("Could not find cutoff point in SettingsPage.tsx");
    }
} catch (err) {
    console.error("Error repairing file:", err);
}
