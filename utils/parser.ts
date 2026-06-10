export interface ParsedKos {
  NAMA_KOS: string;
  KOTA: string;
  JENIS: string;
  ALAMAT: string;
  NEARBY: string;
  KAMAR: string;
  FASILITAS: string;
  FASILITAS_UMUM: string;
  CP: string;
}

export function parseChatKos(text: string): ParsedKos {
  // Pemetaan fleksibel: Mendukung format dengan spasi maupun underscore
  const tags = [
    { key: 'NAMA_KOS', labels: ['NAMA KOS', 'NAMA_KOS'] },
    { key: 'KOTA', labels: ['KOTA'] },
    { key: 'JENIS', labels: ['JENIS'] },
    { key: 'ALAMAT', labels: ['ALAMAT'] },
    { key: 'NEARBY', labels: ['NEARBY'] },
    { key: 'KAMAR', labels: ['KAMAR'] },
    { key: 'FASILITAS', labels: ['FASILITAS'] },
    { key: 'FASILITAS_UMUM', labels: ['FASILITAS UMUM', 'FASILITAS_UMUM'] },
    { key: 'CP', labels: ['CP'] }
  ];

  const data: any = {};

  tags.forEach(({ key, labels }) => {
    let matchedValue = '';
    
    for (const label of labels) {
      // Regex baru: Kebal terhadap spasi berlebih (\s*) dan kebal Windows/Mac line break (\r?\n)
      const regex = new RegExp(`\\[${label}\\]\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n\\s*\\[|$)`, 'i');
      const match = text.match(regex);
      
      if (match) {
        matchedValue = match[1].trim();
        break; // Jika salah satu format label ketemu, berhenti looping label ini
      }
    }
    
    data[key] = matchedValue;
  });

  return data as ParsedKos;
}