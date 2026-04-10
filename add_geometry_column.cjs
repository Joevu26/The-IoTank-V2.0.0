
const fs = require('fs');
const filePath = 'c:\\Users\\josep\\Documents\\The IoTank V2.0.0\\src\\components\\Settings\\SettingsPage.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Headers
const oldHeaderRow = `<th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-secondary" style={{ width: '120px' }}>Fuel</th>
                                                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-secondary" style={{ width: '110px' }}>Cap (L)</th>
                                                        <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-secondary" style={{ width: '90px' }}>Actions</th>`;

const newHeaderRow = `<th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-secondary" style={{ width: '120px' }}>Fuel</th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-secondary" style={{ width: '160px' }}>Geometry</th>
                                                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-secondary" style={{ width: '110px' }}>Cap (L)</th>
                                                        <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-secondary" style={{ width: '90px' }}>Actions</th>`;

// 2. Update Body Row (Fuel + Geometry)
const oldFuelCell = `<td className="px-6 py-4">
                                                                        <span className={\`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider \${fuelBadgeClass}\`}>
                                                                            {tank.fuelType}
                                                                        </span>
                                                                    </td>`;

const newFuelAndGeometry = `<td className="px-6 py-4">
                                                                        <span className={\`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider \${fuelBadgeClass}\`}>
                                                                            {tank.fuelType}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                                                            {tank.shape === 'cylinder' || tank.shape === 'capsule' ? 'Horizontal Cylindrical' : 
                                                                             tank.shape === 'spherical' ? 'Spherical' :
                                                                             tank.shape === 'rectangular' ? 'Rectangular / Flat-Sided' :
                                                                             tank.shape === 'compartmentalized' ? 'Compartmentalized' : tank.shape}
                                                                        </span>
                                                                    </td>`;

function replaceBlock(oldBlock, newBlock, name) {
    const normalizedOld = content.includes('\r\n') ? oldBlock.replace(/\n/g, '\r\n') : oldBlock;
    const normalizedNew = content.includes('\r\n') ? newBlock.replace(/\n/g, '\r\n') : newBlock;

    if (content.includes(normalizedOld)) {
        content = content.replace(normalizedOld, normalizedNew);
        console.log(`${name} replaced`);
        return true;
    } else {
        console.log(`${name} NOT found`);
        return false;
    }
}

replaceBlock(oldHeaderRow, newHeaderRow, "HeaderRow");
replaceBlock(oldFuelCell, newFuelAndGeometry, "FuelAndGeometry");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Finished');
