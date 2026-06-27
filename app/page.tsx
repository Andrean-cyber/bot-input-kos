'use client';

import { useState, useEffect } from 'react';
import { parseChatKos, ParsedKos } from '@/utils/parser';
import { uploadAndSaveKos, getAllKos } from '@/actions/kosActions';
import Image from 'next/image';

export default function Home() {
  // State Form & Loading
  const [template, setTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // State Live Preview
  const [preview, setPreview] = useState<ParsedKos | null>(null);

  // State Pencarian & Database
  const [allKosData, setAllKosData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Fungsi mengambil data terbaru
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

  // Handle Submit Form
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

  // Filter pencarian
  const filteredKos = allKosData.filter(kos => 
    kos.namaKos?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kos.kota?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

const currentKos = filteredKos.slice(
  indexOfFirstItem,
  indexOfLastItem
);

const totalPages = Math.ceil(filteredKos.length / itemsPerPage);

  return (
    
    <main className="min-h-screen py-6 px-3 sm:py-10 sm:px-6 max-w-7xl mx-auto space-y-6 sm:space-y-10 bg-white text-black">
      {/* HEADER UTAMA */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <Image
            src="/babookos.webp"
            alt="Baboo Kos Logo"
            width={30}
            height={30}
            priority
          />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Bot Kos Dashboard
        </h1>

        <p className="text-xs sm:text-sm text-gray-500">
          Otomatisasi Input & Update Data Real-time ke Google Sheets
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
                  Paste Chat Template Di Sini
                </label>
                <textarea
                  name="chatTemplate"
                  rows={8}
                  required
                  placeholder="[NAMA KOS]&#10;Kost.."
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7340] font-mono text-xs sm:text-sm bg-gray-50 text-black"
                />
              </div>

              <div>
                {/* <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                  Upload Foto-Foto Kos
                </label>
                <input
                  type="file"
                  name="images"
                  multiple
                  accept="image/*"
                  className="w-full text-xs sm:text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#F5F6EF] file:text-[#6B7340] hover:file:bg-[#F5F6EF]"
                /> */}
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Link Google Drive Foto Kos
                  </label>

                  <textarea
                    name="gdriveLinks"
                    rows={3}
                    placeholder="https://drive.google.com/view"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7340] text-xs sm:text-sm bg-gray-50 text-black"
                  />

                  <p className="text-xs text-gray-500 mt-1">
                    *Satu link per baris.
                  </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-lg text-xs sm:text-sm font-semibold text-white transition-all duration-300 shadow-sm flex items-center justify-center gap-2 ${
                  loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#6B7340] hover:bg-[#5C6336] active:scale-[0.98]'
                }`}
              >
                {loading && (
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
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
            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[380px] lg:max-h-[420px] text-xs sm:text-sm text-gray-700 bg-gray-50 p-3 sm:p-4 rounded-lg border border-dashed border-gray-300">
              <p><strong>Nama Kos:</strong> <span className="text-[#6B7340] font-semibold">{preview.NAMA_KOS || '-'}</span></p>
              <p><strong>Kota:</strong> <span className="bg-gray-200 px-1.5 py-0.5 rounded text-xs font-medium">{preview.KOTA || '-'}</span></p>
              <p><strong>Jenis:</strong> {preview.JENIS || '-'}</p>
              <p><strong>Alamat:</strong> {preview.ALAMAT || '-'}</p>
              <p><strong>Fasilitas Kamar:</strong> {preview.FASILITAS || '-'}</p>
              <p><strong>Fasilitas Umum:</strong> {preview.FASILITAS_UMUM || '-'}</p>
              <p><strong>Nearby:</strong> {preview.NEARBY || '-'}</p>
              <p><strong>WhatsApp / CP:</strong> <span className="font-mono">{preview.CP || '-'}</span></p>
              <div className="border-t border-gray-200 pt-2.5 mt-2">
                <p className="font-bold text-gray-800 mb-1">Kamar Terdeteksi:</p>
                <pre className="bg-gray-800 text-green-400 p-2 rounded text-xxs sm:text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {preview.KAMAR || 'Kamar belum terisi'}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex-1 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-center p-6 text-xs sm:text-sm min-h-[150px]">
              Paste teks chat kos di form kiri untuk melihat preview ekstraksi data langsung.
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
            <p className="text-xs text-gray-500">Sinkronisasi langsung dengan master data Google Sheets</p>
          </div>
          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Cari nama kos atau kota..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-xs sm:text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#6B7340] text-black"
            />
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
                <th className="px-4 py-3">Kontak</th>
                <th className="px-4 py-3">Foto</th>
                <th className="px-4 py-3">Last Update</th>
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
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{kos.updatedAt}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400 bg-gray-50">Data tidak ditemukan.</td>
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
                <p className="line-clamp-2"><strong>Alamat:</strong> {kos.alamat}</p>
                
                {/* Bagian Galeri Foto di Mobile */}
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
                  Updated: {kos.updatedAt}
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
            onClick={() => setCurrentPage(prev => prev - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 border rounded-lg disabled:opacity-50"
          >
            Prev
          </button>

          <span className="text-sm text-gray-600">
            Halaman {currentPage} dari {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(prev => prev + 1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>

      </div>
    </main>
  );
}