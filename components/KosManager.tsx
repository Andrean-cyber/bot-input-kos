'use client';

import React, { useState, useEffect } from 'react';
import { parseChatKos, ParsedKos } from '@/utils/parser';
import { uploadAndSaveKos, getAllKos } from '@/actions/kosActions';

export default function KosManager() {
  // State Form & Preview
  const [template, setTemplate] = useState('');
  const [images, setImages] = useState<FileList | null>(null);
  const [preview, setPreview] = useState<ParsedKos | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // State Pencarian
  const [allKosData, setAllKosData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Ambil data kos dari Google Sheets saat pertama kali halaman dibuka
  const refreshData = async () => {
    const data = await getAllKos();
    setAllKosData(data);
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Efek Real-time Preview ketika teks template diketik/diubah
  useEffect(() => {
    if (template.trim()) {
      const parsed = parseChatKos(template);
      setPreview(parsed);
    } else {
      setPreview(null);
    }
  }, [template]);

  // Handle Pengiriman Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg({ type: '', text: '' });

    const formData = new FormData();
    formData.append('chatTemplate', template);
    if (images) {
      Array.from(images).forEach((file) => formData.append('images', file));
    }

    const result = await uploadAndSaveKos(formData);
    setIsSubmitting(false);

    if (result.success) {
      setStatusMsg({ type: 'success', text: result.message || '' });
      setTemplate('');
      setImages(null);
      refreshData(); // Refresh list pencarian otomatis
    } else {
      setStatusMsg({ type: 'error', text: result.error || 'Gagal menyimpan data.' });
    }
  };

  // Filter Data Kos berdasarkan input pencarian (Nama atau Kota)
  const filteredKos = allKosData.filter(kos => 
    kos.namaKos?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kos.kota?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen space-y-10">
      <h1 className="text-3xl font-extrabold text-gray-900 text-center">Dashboard Sistem Management Kos</h1>

      {/* BLOCK 1: INPUT & LIVE PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Form Input */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Input Data Chat Kos</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paste Template Chat Di Sini:</label>
              <textarea
                rows={12}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm bg-gray-50"
                placeholder="[NAMA KOS]&#10;Kost Melati..."
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload Gambar/Foto Kos:</label>
              <input
                type="file"
                multiple
                accept="image/*"
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                onChange={(e) => setImages(e.target.files)}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !template}
              className={`w-full py-3 rounded-lg font-bold text-white transition duration-200 ${
                isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? 'Sedang Memproses Data (Cloudinary & Sheets)...' : 'Proses & Simpan Data'}
            </button>

            {statusMsg.text && (
              <div className={`p-3 rounded-lg text-sm font-semibold text-center ${
                statusMsg.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {statusMsg.text}
              </div>
            )}
          </form>
        </div>

        {/* Live Preview Section */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 flex flex-col">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            Live Preview Data
          </h2>
          
          {preview ? (
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[480px] text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300">
              <p><strong>Nama Kos:</strong> <span className="text-blue-600">{preview.NAMA_KOS || '-'}</span></p>
              <p><strong>Kota:</strong> {preview.KOTA || '-'}</p>
              <p><strong>Jenis:</strong> {preview.JENIS || '-'}</p>
              <p><strong>Alamat:</strong> {preview.ALAMAT || '-'}</p>
              <p><strong>Fasilitas Kamar:</strong> {preview.FASILITAS || '-'}</p>
              <p><strong>Fasilitas Umum:</strong> {preview.FASILITAS_UMUM || '-'}</p>
              <p><strong>Nearby / Terdekat:</strong> {preview.NEARBY || '-'}</p>
              <p><strong>Contact Person:</strong> {preview.CP || '-'}</p>
              <div className="border-t border-gray-200 pt-2 mt-2">
                <p className="font-bold text-gray-800 mb-1">Daftar Kamar yang Terdeteksi:</p>
                <pre className="bg-gray-800 text-green-400 p-2 rounded text-xs font-mono">
                  {preview.KAMAR || 'Tidak ada kamar terdeteksi'}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex-1 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-center p-6">
              Silakan ketik atau paste template chat kos di form sebelah kiri untuk melihat live preview data.
            </div>
          )}
        </div>
      </div>

      {/* BLOCK 2: PENCARIAN & DATA LIVE */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <div className="sm:flex sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Database & Pencarian Kos</h2>
            <p className="text-sm text-gray-500 mt-1">Menampilkan data real-time langsung dari Google Sheets</p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-4">
            <input
              type="text"
              placeholder="Cari berdasarkan Nama Kos atau Kota..."
              className="w-full sm:w-80 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tabel Data Kos */}
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
            <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold">
              <tr>
                <th className="px-4 py-3">Nama Kos</th>
                <th className="px-4 py-3">Kota</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3">Alamat</th>
                <th className="px-4 py-3">Kontak</th>
                <th className="px-4 py-3">Foto (Cloudinary)</th>
                <th className="px-4 py-3">Last Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-gray-600">
              {filteredKos.length > 0 ? (
                filteredKos.map((kos) => (
                  <tr key={kos.idKos} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-semibold text-gray-900">{kos.namaKos}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 bg-gray-100 rounded text-xs">{kos.kota}</span></td>
                    <td className="px-4 py-3">{kos.jenis}</td>
                    <td className="px-4 py-3 truncate max-w-xs" title={kos.alamat}>{kos.alamat}</td>
                    <td className="px-4 py-3 font-mono text-xs">{kos.cp}</td>
                    <td className="px-4 py-3">
                      {kos.foto.length > 0 ? (
                        <div className="flex gap-1 overflow-x-auto max-w-[120px]">
                          {kos.foto.map((url: string, index: number) => (
                            <a key={index} href={url} target="_blank" rel="noreferrer" className="text-blue-500 underline text-xs whitespace-nowrap bg-blue-50 px-1.5 py-0.5 rounded">
                              F-{index + 1}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">No Photo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{kos.updatedAt}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Tidak ada data kos ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}