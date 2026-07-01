export interface ParsedKos {
  KOTA: string;
  NAMA_KOS: string;
  JENIS: string; // '' | 'Putra' | 'Putri' | 'Campur' | 'LV'
  TANGGAL_INPUT: string; // DD/MM/YYYY
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

export function normalizeTanggalInput(raw: string): { value: string; isFallback: boolean } {
  const today = getTodayFormatted();

  if (!raw || !raw.trim()) {
    return { value: today, isFallback: false };
  }

  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) {
    return { value: today, isFallback: true };
  }

  const [, dd, mm, yyyy] = match;
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);

  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return { value: today, isFallback: true };
  }

  return { value: `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`, isFallback: false };
}

export function parseChatKos(text: string): ParsedKos & { tanggalIsFallback?: boolean } {
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

  const tanggalResult = normalizeTanggalInput(data.TANGGAL_INPUT);
  data.TANGGAL_INPUT = tanggalResult.value;
  data.tanggalIsFallback = tanggalResult.isFallback;

  return data as ParsedKos & { tanggalIsFallback?: boolean };
}