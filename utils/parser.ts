export interface ParsedKos {
  KOTA: string;
  NAMA_KOS: string;
  JENIS: string; // '' | 'Putra' | 'Putri' | 'Campur' | 'LV'
  TANGGAL_INPUT: string;
  ALAMAT: string;
  NEARBY: string; // -> akan dipetakan ke kolom "Ket"
  HARGA: string;
  FASILITAS: string;
  CP: string;
}

// Hanya 4 jenis kos
export const JENIS_VALID = ['Putra', 'Putri', 'Campur', 'LV'];

export function normalizeJenis(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, '');

  if (cleaned === 'putra') return 'Putra';
  if (cleaned === 'putri') return 'Putri';
  if (cleaned === 'campur' || cleaned === 'mix') return 'Campur';
  if (cleaned === 'lv') return 'LV';

  return '';
}

// Deteksi otomatis JENIS dari teks jika tag [JENIS] kosong/tidak valid.
// Karena opsi "Putra/Putri" sudah dihapus, kos campur cowok-cewek -> dianggap "Campur".
export function detectJenis(text: string): string {
  const lower = text.toLowerCase();
  const hasPutra = /\bputra\b/.test(lower);
  const hasPutri = /\bputri\b/.test(lower);
  const hasCampur = /\bcampur\b|\bcowok\s*cewek\b|\bmix\b/.test(lower);

  if (hasCampur) return 'Campur';
  if (hasPutra && hasPutri) return 'Campur';
  if (hasPutri) return 'Putri';
  if (hasPutra) return 'Putra';
  return '';
}

function getTodayFormatted(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function parseChatKos(text: string): ParsedKos {
  const tags: { key: keyof ParsedKos; labels: string[] }[] = [
    { key: 'KOTA', labels: ['KOTA'] },
    { key: 'NAMA_KOS', labels: ['NAMA KOS', 'NAMA_KOS'] },
    { key: 'JENIS', labels: ['JENIS'] },
    { key: 'TANGGAL_INPUT', labels: ['TANGGAL INPUT', 'TANGGAL_INPUT'] },
    { key: 'ALAMAT', labels: ['ALAMAT'] },
    { key: 'NEARBY', labels: ['NEARBY'] },
    { key: 'HARGA', labels: ['HARGA'] },
    { key: 'FASILITAS', labels: ['FASILITAS'] },
    { key: 'CP', labels: ['CP'] },
  ];

  const data: any = {};

  tags.forEach(({ key, labels }) => {
    let matchedValue = '';
    for (const label of labels) {
      const regex = new RegExp(`\\[${label}\\]\\s*\\r?\\n?([\\s\\S]*?)(?=\\r?\\n\\s*\\[|$)`, 'i');
      const match = text.match(regex);
      if (match) {
        matchedValue = match[1].trim();
        break;
      }
    }
    data[key] = matchedValue;
  });

  const jenisNormalized = normalizeJenis(data.JENIS);
  data.JENIS = jenisNormalized || detectJenis(data.NAMA_KOS + ' ' + data.ALAMAT);

  // TANGGAL_INPUT teks bebas, sama seperti field lain.
  // Kalau kosong, default ke tanggal hari ini (DD/MM/YYYY).
  data.TANGGAL_INPUT = data.TANGGAL_INPUT.trim() || getTodayFormatted();

  return data as ParsedKos;
}