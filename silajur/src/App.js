import React, { useState, useRef } from 'react';
import Webcam from "react-webcam";
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import { Upload, ArrowRight, RefreshCcw, LogOut, Camera as CameraIcon, Mail, ArrowLeft, User, Phone, MapPin } from 'lucide-react';
import logo from './logo.png'; 

// Fix Icon Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [origin, setOrigin] = useState('');
  
  const [file, setFile] = useState(null);
  const [currentFilename, setCurrentFilename] = useState(null); 
  const [currentResultFilename, setCurrentResultFilename] = useState(null);

  const [previewOriginal, setPreviewOriginal] = useState(null); 
  const [previewResult, setPreviewResult] = useState(null); 
  const [damageStatus, setDamageStatus] = useState(""); 
  const [fileType, setFileType] = useState('image'); 
  const [location, setLocation] = useState(null); 
  
  const [formData, setFormData] = useState({
    nama: '',
    whatsapp: '',
    pesan: ''
  });
  
  const [showEmailModal, setShowEmailModal] = useState(false);
  const webcamRef = useRef(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // --- LOGIC CLEANUP ---
  const cleanupFiles = async () => {
    if (!currentFilename) return; 
    try {
      await axios.post('https://mahendra284des-silajur-api.hf.space/cleanup', {
        filename: currentFilename,
        result_filename: currentResultFilename
      });
      console.log("Request cleanup dikirim.");
    } catch (error) {
      console.error("Gagal cleanup:", error);
    }
    setCurrentFilename(null);
    setCurrentResultFilename(null);
  };

  const resetState = () => {
    cleanupFiles();
    setFile(null); 
    setPreviewOriginal(null); 
    setPreviewResult(null); 
    setDamageStatus(""); 
    setLocation(null);
    setFormData({ nama: '', whatsapp: '', pesan: '' });
  };

  const handleMenuClick = (menu) => {
    resetState();
    if (menu === 'laporkan') { setOrigin('laporan'); setCurrentView('upload'); } 
    else if (menu === 'deteksi-kamera') setCurrentView('camera');
    else if (menu === 'deteksi-gambar') { setOrigin('deteksi-gambar'); setCurrentView('upload'); }
    else if (menu === 'deteksi-video') { setOrigin('deteksi-video'); setCurrentView('upload'); }
  };

  const handleBack = () => {
    if (currentView === 'map') {
      resetState(); 
      setCurrentView('upload'); 
    } else if (currentView === 'upload') {
      resetState(); 
      setCurrentView('home');
    } else if (currentView === 'camera') {
      setIsCameraOpen(false);
      setCurrentView('home');
    } else {
      setCurrentView('home');
    }
  };

  const handleProceedToMap = () => {
    cleanupFiles();
    setCurrentView('map');
  };

  const handleWhatsappInput = (e) => {
    const value = e.target.value;
    if (/^[0-9+]*$/.test(value)) {
      setFormData({...formData, whatsapp: value});
    }
  };

  const getAcceptedFileTypes = () => {
    if (origin === 'deteksi-gambar') return "image/*";
    if (origin === 'deteksi-video') return "video/*";
    return "image/*,video/*";
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (origin === 'deteksi-gambar' && selectedFile.type.startsWith('video')) { alert("Mohon upload GAMBAR saja."); return; }
      if (origin === 'deteksi-video' && selectedFile.type.startsWith('image')) { alert("Mohon upload VIDEO saja."); return; }

      if (currentFilename) cleanupFiles();

      setFile(selectedFile);
      setPreviewOriginal(URL.createObjectURL(selectedFile));
      setPreviewResult(null); 
      setDamageStatus("");
    }
  };

  const handleCheckDamage = async () => {
    if (!file) return;
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      setDamageStatus("Sedang menganalisa...");
      const response = await axios.post('https://mahendra284des-silajur-api.hf.space/upload', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setFileType(response.data.type);
      setDamageStatus(response.data.status);
      
      setCurrentFilename(response.data.filename); 
      if (response.data.result_filename) setCurrentResultFilename(response.data.result_filename);

      if (response.data.type === 'video_stream') {
        setPreviewResult(response.data.result_url + "?t=" + new Date().getTime());
      } else {
        setPreviewResult(response.data.result_url);
      }
      
    } catch (error) {
      console.error("Error:", error);
      alert("Gagal terhubung ke Server.");
      setDamageStatus("Gagal.");
    }
  };

  // --- LOGIC EMAIL ---
  const handleShowEmailModal = () => {
    if (!location) { alert("Mohon pilih lokasi di peta."); return; }
    if (!formData.nama || !formData.whatsapp) { alert("Mohon lengkapi Nama dan No WhatsApp."); return; }
    setShowEmailModal(true);
  };

  const handleConfirmEmail = () => {
    const subject = `Laporan Jalan Rusak - ${new Date().toLocaleDateString()} - ${formData.nama}`;
    const mapsLink = `http://googleusercontent.com/maps.google.com/?q=${location.lat},${location.lng}`;
    
    const body = `Yth. Admin SILAJUR,

Saya ingin melaporkan kerusakan jalan dengan detail sebagai berikut:

DATA PELAPOR:
----------------------
👤 Nama: ${formData.nama}
📱 WhatsApp/HP: ${formData.whatsapp}

PESAN & DETAIL LOKASI:
----------------------
📝 "${formData.pesan || '-'}"

DATA TEKNIS (AI):
----------------------
🛠️ Status Kerusakan: ${damageStatus}
📍 Koordinat: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}
🗺️ Link Maps: ${mapsLink}
----------------------

(Foto/Video bukti asli telah saya lampirkan manual).`;
    
    window.location.href = `mailto:mahendra284des@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    setShowEmailModal(false);
    resetState(); 
    setCurrentView('home');
  };

  // --- HELPERS ---
  const renderOriginal = (url, fileObj) => {
    if (!url) return <span className="text-gray-400">Preview</span>;
    const isVideo = fileObj?.type.startsWith('video');
    if (isVideo) return <video controls className="w-full h-full object-contain rounded-lg"><source src={url} /></video>;
    return <img src={url} alt="Original" className="w-full h-full object-contain rounded-lg" />;
  };

  const renderResult = (url, type) => {
    if (!url) return <span className="text-gray-400">Hasil Analisa</span>;
    if (type === 'video_stream') return <img src={url} alt="Stream" className="w-full h-full object-contain bg-black rounded-lg" />;
    return <img src={url} alt="Hasil" className="w-full h-full object-contain rounded-lg" />;
  };

  function LocationMarker() {
    useMapEvents({ click(e) { setLocation(e.latlng); }, });
    return location === null ? null : <Marker position={location}></Marker>;
  }

  // --- COMPONENTS ---
  const Header = () => (
    <div className="w-full flex items-center justify-between mb-8 px-4">
      <div className="flex items-center gap-3">
        <img src={logo} alt="Logo" className="h-12 md:h-16 object-contain" />
        <div className="flex flex-col">
          <h1 className="text-xl md:text-2xl font-bold text-blue-900 leading-none">SILAJUR</h1>
          <span className="text-xs md:text-sm text-blue-600 font-medium">Sistem Informasi Laporan Jalan Umum Rusak</span>
        </div>
      </div>
    </div>
  );

  const BackButton = () => (
    <button onClick={handleBack} className="absolute top-6 left-4 md:left-8 bg-white p-2 rounded-full shadow-lg hover:bg-gray-100 z-40 text-blue-900 transition-transform hover:scale-110 border border-gray-200" title="Kembali"><ArrowLeft size={24} strokeWidth={3} /></button>
  );

  const EmailModal = () => {
    if (!showEmailModal) return null;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><Mail size={32} className="text-green-600" /></div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Buka Aplikasi Email?</h3>
          <p className="text-gray-600 mb-6 text-sm">Sistem akan membuka email Anda. <br/><br/><b className="text-red-600">PENTING: JANGAN LUPA LAMPIRKAN FOTO BUKTI SECARA MANUAL.</b></p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowEmailModal(false)} className="px-6 py-2 rounded-xl border border-gray-300 font-bold hover:bg-gray-50">Batal</button>
            <button onClick={handleConfirmEmail} className="px-6 py-2 rounded-xl bg-blue-800 text-white font-bold hover:bg-blue-900 shadow-lg flex items-center gap-2">OK, Kirim <ArrowRight size={18}/></button>
          </div>
        </div>
      </div>
    );
  };

  // --- VIEWS ---
  if (currentView === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-5xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden p-8 md:p-12 border border-blue-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-6">
              <img src={logo} alt="Logo" className="w-40 h-40 md:w-56 md:h-56 object-contain drop-shadow-lg" />
              <div>
                <h1 className="text-4xl md:text-5xl font-extrabold text-blue-900 tracking-tight mb-2">SILAJUR</h1>
                <p className="text-lg md:text-xl text-blue-600 font-medium">Sistem Informasi Laporan<br/>Jalan Umum Rusak</p>
              </div>
            </div>
            <div className="flex flex-col space-y-4 w-full max-w-sm mx-auto">
              <p className="text-gray-500 text-center mb-2 font-medium">Pilih Menu Layanan:</p>
              <button onClick={() => handleMenuClick('laporkan')} className="bg-blue-800 hover:bg-blue-900 text-white font-bold py-4 px-6 rounded-2xl shadow-lg transform hover:-translate-y-1 transition-all flex items-center justify-center gap-3">📋 Laporkan Kerusakan</button>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleMenuClick('deteksi-kamera')} className="bg-white border-2 border-blue-800 text-blue-900 hover:bg-blue-50 font-bold py-3 px-4 rounded-xl shadow-sm text-sm">📷 Cek Kamera</button>
                <button onClick={() => handleMenuClick('deteksi-gambar')} className="bg-white border-2 border-blue-800 text-blue-900 hover:bg-blue-50 font-bold py-3 px-4 rounded-xl shadow-sm text-sm">🖼️ Cek Gambar</button>
                <button onClick={() => handleMenuClick('deteksi-video')} className="col-span-2 bg-white border-2 border-blue-800 text-blue-900 hover:bg-blue-50 font-bold py-3 px-4 rounded-xl shadow-sm text-sm">🎥 Cek Video</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'upload') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 relative">
        <BackButton />
        <div className="w-full max-w-6xl mt-8 bg-white p-6 md:p-8 rounded-3xl shadow-xl">
          <Header />
          <h2 className="text-2xl font-bold text-center text-blue-900 mb-8 border-b pb-4">{origin === 'laporan' ? 'Upload Bukti' : 'Deteksi Kerusakan'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="flex flex-col space-y-3">
              <div className="flex justify-between items-center px-2">
                <span className="font-bold text-gray-700">1. File Asli</span>
                {file && (<label className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded-full cursor-pointer font-bold transition-colors">Ganti File<input type="file" className="hidden" accept={getAcceptedFileTypes()} onChange={handleFileChange} /></label>)}
              </div>
              <div className="w-full h-72 border-4 border-dashed border-blue-200 rounded-2xl flex flex-col items-center justify-center bg-blue-50 overflow-hidden relative">
                {previewOriginal ? renderOriginal(previewOriginal, file) : (
                  <label className="cursor-pointer flex flex-col items-center w-full h-full justify-center group">
                    <div className="bg-white p-4 rounded-full shadow-md mb-3 group-hover:scale-110 transition-transform"><Upload size={32} className="text-blue-600" /></div>
                    <span className="text-lg font-bold text-blue-800">Klik untuk Upload</span>
                    <input type="file" className="hidden" accept={getAcceptedFileTypes()} onChange={handleFileChange} />
                  </label>
                )}
              </div>
            </div>
            <div className="flex flex-col space-y-3">
              <span className="font-bold text-gray-700 ml-2">2. Hasil Analisa Sistem</span>
              <div className="w-full h-72 border-4 border-gray-200 rounded-2xl flex flex-col items-center justify-center bg-gray-100 overflow-hidden relative shadow-inner">
                {previewResult ? renderResult(previewResult, fileType) : <div className="text-center text-gray-400"><p className="text-lg font-bold">Menunggu Proses...</p></div>}
              </div>
              {damageStatus && <div className={`text-center p-3 rounded-xl font-bold ${damageStatus.includes('Aman') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>Status: {damageStatus}</div>}
            </div>
          </div>
          <div className="flex justify-center py-4">
            {!previewResult ? (
              <button onClick={handleCheckDamage} disabled={!file} className={`${!file ? 'bg-gray-300' : 'bg-blue-800 hover:bg-blue-900'} text-white font-bold py-3 px-12 rounded-full text-xl shadow-lg`}>🔍 Mulai Deteksi</button>
            ) : (
              origin === 'laporan' ? (
                <button onClick={handleProceedToMap} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-16 rounded-full text-xl shadow-lg flex items-center gap-2">Lanjut Isi Data <ArrowRight /></button>
              ) : (
                <button onClick={resetState} className="bg-blue-800 hover:bg-blue-900 text-white font-bold py-3 px-12 rounded-full text-xl shadow-lg flex items-center gap-2"><RefreshCcw size={20} /> Coba Lagi</button>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'map') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 relative">
        <BackButton />
        <EmailModal />
        
        <div className="w-full max-w-5xl mt-8 bg-white p-6 md:p-8 rounded-3xl shadow-xl">
          <Header />
          <h2 className="text-2xl font-bold text-blue-900 mb-6 text-center border-b pb-4">Lengkapi Data Laporan</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2"><User size={20}/> Identitas Pelapor</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="text-sm font-semibold text-gray-600">Nama Lengkap *</label>
                            <input type="text" placeholder="Contoh: Budi Santoso" className="w-full p-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none" 
                                value={formData.nama} onChange={(e) => setFormData({...formData, nama: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-gray-600">No. WhatsApp/HP *</label>
                            <input 
                              type="text" 
                              inputMode="numeric"
                              placeholder="Contoh: 08123456789" 
                              className="w-full p-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none"
                              value={formData.whatsapp} 
                              onChange={handleWhatsappInput}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                    <h3 className="font-bold text-yellow-900 mb-3 flex items-center gap-2"><MapPin size={20}/> Detail & Pesan Urgensi</h3>
                    <div>
                        <label className="text-sm font-semibold text-gray-600">Patokan Lokasi / Pesan untuk Petugas</label>
                        <textarea 
                             placeholder="Contoh: Lokasi depan pagar biru. Mohon SEGERA diperbaiki Pak, karena semalam sudah ada pengendara motor yang jatuh di sini." 
                             className="w-full p-2 rounded-lg border focus:ring-2 focus:ring-yellow-500 outline-none h-28 resize-none text-sm"
                             value={formData.pesan} 
                             onChange={(e) => setFormData({...formData, pesan: e.target.value})} 
                        ></textarea>
                    </div>
                </div>
            </div>

            <div className="flex flex-col h-full">
                <h3 className="font-bold text-gray-700 mb-2">Titik Koordinat (Klik Peta) *</h3>
                <div className="flex-1 min-h-[300px] rounded-xl overflow-hidden border-2 border-blue-200 relative z-0">
                    {/* ATTRIBUTION CONTROL FALSE = HILANGKAN TULISAN OPENSTREETMAP */}
                    <MapContainer center={[-7.8, 110.3]} zoom={13} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }} attributionControl={false}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <LocationMarker />
                    </MapContainer>
                </div>
                {location ? (
                    <p className="text-green-600 text-sm mt-2 font-bold text-center bg-green-50 p-2 rounded">✓ Lokasi: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}</p>
                ) : (
                    <p className="text-red-500 text-sm mt-2 font-bold text-center animate-pulse">Wajib klik titik lokasi di peta!</p>
                )}
            </div>
          </div>

          <div className="flex justify-center mt-8 pt-4 border-t">
            <button onClick={handleShowEmailModal} disabled={!location || !formData.nama || !formData.whatsapp} className={`${(!location || !formData.nama || !formData.whatsapp) ? 'bg-gray-300' : 'bg-blue-800 hover:bg-blue-900 hover:scale-105'} text-white font-bold py-3 px-16 rounded-full text-xl shadow-lg flex items-center justify-center gap-3 transition-all`}>
              <Mail size={24} /> Buka Email & Kirim Laporan
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'camera') {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 relative">
          <BackButton />
          <div className="absolute top-6 left-16 md:left-24 flex items-center gap-2">
             <img src={logo} alt="Logo" className="h-10 object-contain" />
             <span className="font-bold text-xl text-blue-900 tracking-wider">SILAJUR</span>
          </div>
          <div className="w-full max-w-5xl aspect-video bg-black rounded-3xl border-4 border-gray-300 relative flex items-center justify-center overflow-hidden shadow-2xl">
            {!isCameraOpen ? (
              <div className="flex flex-col items-center">
                 <div className="bg-white p-6 rounded-full mb-4 shadow-md"><CameraIcon size={48} className="text-blue-600"/></div>
                 <button onClick={() => setIsCameraOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-10 rounded-full text-lg z-10 shadow-lg">Buka Kamera</button>
              </div>
            ) : (
              <>
                 <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="absolute inset-0 w-full h-full object-cover" />
                 <div className="absolute top-4 right-4 animate-pulse"><span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-bold uppercase">Live Detection</span></div>
                 <div className="absolute bottom-6 bg-white/90 backdrop-blur-sm px-8 py-3 rounded-full border border-blue-200 shadow-lg"><p className="font-bold text-blue-900 tracking-wide">Sistem Sedang Bekerja...</p></div>
              </>
            )}
          </div>
        </div>
      );
    }
  return null;
}

export default App;