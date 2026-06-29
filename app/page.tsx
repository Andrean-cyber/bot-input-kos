'use client';

import { useState, useEffect } from 'react';
import { parseChatKos, JENIS_VALID, KATEGORI_VALID } from '@/utils/parser';
import { uploadAndSaveKos, getAllKos } from '@/actions/kosActions';
import Image from 'next/image';

export default function Home() {
  // State Form & Loading
  const [template, setTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // State Live Preview
  const [preview, setPreview] = useState<ReturnType<typeof parseChatKos> | null>(null);

  // State Pencarian & Database
  const [allKosData, setAllKosData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const refreshData = async () => {
    const data = await getAllKos();
    setAllKosData(data);
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Live Preview Effect
  useEffect(() => {
    if (template.trim()) {
      const parsed = parseChatKos(template);
      setPreview(parsed);
    } else {
      setPreview(null);
    }
  }, [template]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const formData = new FormData(e.currentTarget);
    const result = await uploadAndSaveKos(formData);

    setLoading(false);
    if (result.success) {
      setMessage('✅ ' + result.message);
      setTemplate('');
      (e.target as HTMLFormElement).reset();
      refreshData();
    } else {
      setMessage('❌ Error: ' + result.error);
    }
  };

  // Filter pencarian: nama kos, jenis kos, dan kota
  const filteredKos = allKosData.filter(
    (kos) =>
      kos.namaKos?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kos.kota?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kos.jenis?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentKos = filteredKos.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredKos.length / itemsPerPage);

  return (
    <main className="min-h-screen py-6 px-3 sm:py-10 sm:px-6 max-w-7xl mx-auto space-y-6 sm:space-y-10 bg-white text-black">
      {/* HEADER UTAMA */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <Image src="/babookos.webp" alt="Baboo Kos Logo" width={30} height={30} priority />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Bot Kos Dashboard
        </h1>

        <p className="text-xs sm:text-sm text-gray-500">
          Otomatisasi Input & Update Data Real-time ke Google Sheets (per Kota & Kategori)
        </p>
      </div>

      {/* ================= SECTION 1: INPUT & PREVIEW (GRID) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* KIRI: Form Input */}
        <div className="bg-white shadow-sm rounded-xl p-4 sm:p-6 border border-gray-200 flex flex-col justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4">Form Input Data</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                  Paste Template Kos Di Sini
                </label>
                <textarea
                  name="chatTemplate"
                  rows={10}
                  required
                  placeholder={'[KOTA] Malang\n[KATEGORI] Endorse\n[NAMA KOS] Kost..'}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7340] font-mono text-xs sm:text-sm bg-gray-50 text-black"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                  Link Google Drive Foto Kos
                </label>

                <textarea
                  name="gdriveLinks"
                  rows={3}
                  placeholder="https://drive.google.com/view"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7340] text-xs sm:text-sm bg-gray-50 text-black"
                />

                <p className="text-xs text-gray-500 mt-1">*Satu link per baris.</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-lg text-xs sm:text-sm font-semibold text-white transition-all duration-300 shadow-sm flex items-center justify-center gap-2 ${
                  loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#6B7340] hover:bg-[#5C6336] active:scale-[0.98]'
                }`}
              >
                {loading && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                )}
                {loading ? 'Sedang Memproses & Sinkronisasi...' : 'Proses Data Otomatis'}
              </button>
            </form>
          </div>

          {message && (
            <div className="mt-4 p-3 rounded-lg text-xs sm:text-sm text-center bg-[#F5F6EF] border border-[#D7DDBA] font-medium text-[#6B7340] break-words">
              {message}
            </div>
          )}
        </div>

        {/* KANAN: Live Preview Panel */}
        <div className="bg-white shadow-sm rounded-xl p-4 sm:p-6 border border-gray-200 flex flex-col">
          <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-[#F5F6EF] rounded-full animate-pulse"></span>
            Live Preview (Deteksi Otomatis)
          </h2>

          {preview ? (
            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[420px] lg:max-h-[460px] text-xs sm:text-sm text-gray-700 bg-gray-50 p-3 sm:p-4 rounded-lg border border-dashed border-gray-300">
              <p>
                <strong>Kota:</strong>{' '}
                <span className="bg-gray-200 px-1.5 py-0.5 rounded text-xs font-medium">{preview.KOTA || '-'}</span>
                {' '}
                <span className="text-xxs text-gray-400">
                  ({preview.KOTA ? 'sheet akan dibuat otomatis jika belum ada' : 'wajib diisi!'})
                </span>
              </p>
              <p>
                <strong>Kategori:</strong>{' '}
                {preview.KATEGORI ? (
                  <span className="px-1.5 py-0.5 bg-[#F5F6EF] text-[#6B7340] border border-[#D7DDBA] rounded text-xs font-medium">
                    {preview.KATEGORI}
                  </span>
                ) : (
                  <span className="text-gray-400">- (tidak masuk sheet kategori)</span>
                )}
                <span className="text-xxs text-gray-400 ml-1">
                  (opsi: {KATEGORI_VALID.join(', ')})
                </span>
              </p>
              <p>
                <strong>Nama Kos:</strong> <span className="text-[#6B7340] font-semibold">{preview.NAMA_KOS || '-'}</span>
              </p>
              <div className="flex items-center gap-2">
                <strong>Jenis:</strong>
                <select
                  value={preview.JENIS || ''}
                  onChange={() => {}}
                  className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                >
                  <option value="">- (tidak terdeteksi)</option>
                  {JENIS_VALID.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
                <span className="text-xxs text-gray-400">(auto-deteksi, bisa override pakai tag [JENIS])</span>
              </div>
              <p>
                <strong>Tanggal Input:</strong> {preview.TANGGAL_INPUT || '-'}
                {preview.tanggalIsFallback && (
                  <span className="text-amber-600 text-xxs ml-1">⚠️ format salah, dipakai tanggal hari ini</span>
                )}
              </p>
              <p><strong>Alamat:</strong> {preview.ALAMAT || '-'}</p>
              <p><strong>Nomor/CP:</strong> <span className="font-mono">{preview.CP || '-'}</span></p>
              <p><strong>Harga:</strong> {preview.HARGA || '-'}</p>
              <p><strong>Nearby:</strong> {preview.NEARBY || '-'}</p>
              <p><strong>Fasilitas:</strong> {preview.FASILITAS || '-'}</p>
              {preview.KATEGORI && (
                <p><strong>Kamar Kosong:</strong> {preview.KAMAR_KOSONG || '-'}</p>
              )}
            </div>
          ) : (
            <div className="flex-1 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-center p-6 text-xs sm:text-sm min-h-[150px]">
              Paste template kos di form kiri untuk melihat preview ekstraksi data langsung.
            </div>
          )}
        </div>
      </div>

      {/* ================= SECTION 2: DATABASE & SEARCH ================= */}
      <div className="bg-white shadow-sm rounded-xl p-4 sm:p-6 border border-gray-200">
        {/* Search Bar & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-800">Database Kos</h2>
            <p className="text-xs text-gray-500">Sinkronisasi langsung dengan sheet kota di Google Sheets</p>
          </div>
          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Cari nama kos, jenis, atau kota..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-xs sm:text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6B7340] text-black"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Ditemukan <span className="font-semibold text-gray-700">{filteredKos.length}</span> kos
              {searchQuery && (
                <> untuk &quot;<span className="font-semibold">{searchQuery}</span>&quot;</>
              )}
            </p>
          </div>
        </div>

        {/* A. TAMPILAN LAPTOP / DESKTOP (TABEL) */}
        <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm text-left">
            <thead className="bg-gray-50 text-gray-700 uppercase text-xxs font-semibold tracking-wider">
              <tr>
                <th className="px-4 py-3">Nama Kos</th>
                <th className="px-4 py-3">Kota</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3">Alamat</th>
                <th className="px-4 py-3">Harga</th>
                <th className="px-4 py-3">Kontak</th>
                <th className="px-4 py-3">Foto</th>
                <th className="px-4 py-3">Tanggal Input</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-gray-600">
              {currentKos.length > 0 ? (
                currentKos.map((kos) => (
                  <tr key={kos.idKos} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-semibold text-gray-900">{kos.namaKos}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-[#F5F6EF] text-[#6B7340] border border-[#D7DDBA] rounded text-xs font-medium">
                        {kos.kota}
                      </span>
                    </td>
                    <td className="px-4 py-3">{kos.jenis}</td>
                    <td className="px-4 py-3 truncate max-w-xs" title={kos.alamat}>{kos.alamat}</td>
                    <td className="px-4 py-3">{kos.harga}</td>
                    <td className="px-4 py-3 font-mono text-xs">{kos.cp}</td>
                    <td className="px-4 py-3">
                      {kos.foto?.map((foto: any, index: number) => (
                        <a
                          key={index}
                          href={foto.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-[#6B7340] hover:underline"
                        >
                          {foto.name}
                        </a>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{kos.tanggalInput}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400 bg-gray-50">Data tidak ditemukan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* B. TAMPILAN HP / MOBILE (CARD LIST STYLE) */}
        <div className="block md:hidden space-y-4">
          {currentKos.length > 0 ? (
            currentKos.map((kos) => (
              <div key={kos.idKos} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs text-gray-600 shadow-xs">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-gray-900 text-sm">{kos.namaKos}</h3>
                  <span className="px-2 py-0.5 bg-[#F5F6EF] text-[#6B7340] rounded text-xxs font-semibold uppercase">{kos.kota}</span>
                </div>
                <p><strong>Jenis:</strong> {kos.jenis} | <strong>Kontak:</strong> <span className="font-mono">{kos.cp}</span></p>
                <p><strong>Harga:</strong> {kos.harga}</p>
                <p className="line-clamp-2"><strong>Alamat:</strong> {kos.alamat}</p>

                <div className="pt-1 flex flex-wrap gap-1 items-center">
                  <span className="font-semibold text-gray-700 mr-1">Foto ({kos.foto ? kos.foto.length : 0}):</span>
                  {kos.foto && kos.foto.length > 0 ? (
                    kos.foto.map((foto: any, index: number) => (
                      <a
                        key={index}
                        href={foto.url}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-white border border-gray-300 rounded px-2 py-0.5 text-xxs font-medium text-[#6B7340] active:bg-[#F5F6EF]"
                      >
                        {foto.name}
                      </a>
                    ))
                  ) : (
                    <span className="text-gray-400 text-xxs">Kosong</span>
                  )}
                </div>
                <div className="text-right text-xxs text-gray-400 pt-1 border-t border-gray-200/60 font-mono">
                  Input: {kos.tanggalInput}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400 text-xs bg-gray-50 rounded-lg border border-dashed border-gray-200">
              Data tidak ditemukan.
            </div>
          )}
        </div>

        <div className="flex justify-center items-center gap-3 mt-6">
          <button
            onClick={() => setCurrentPage((prev) => prev - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 border rounded-lg disabled:opacity-50"
          >
            Prev
          </button>

          <span className="text-sm text-gray-600">
            Halaman {currentPage} dari {totalPages || 1}
          </span>

          <button
            onClick={() => setCurrentPage((prev) => prev + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-4 py-2 border rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
