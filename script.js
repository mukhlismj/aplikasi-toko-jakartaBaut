const API_URL = "http://localhost:3000/data";

let kategoriAktif = null;

// Login
const USER = "admin";
const PASS = "12345";

window.onload = () => {
  // cek status login
  if (localStorage.getItem("loggedIn") === "true") {
    document.getElementById("loginModal").style.display = "none";
    document.querySelector(".main-content").style.display = "block";
  } else {
    document.getElementById("loginModal").style.display = "block";
    document.querySelector(".main-content").style.display = "none";
  }
};

function login() {
  const u = document.getElementById("username").value.trim();
  const p = document.getElementById("password").value.trim();

  if (u === USER && p === PASS) {
    localStorage.setItem("loggedIn", "true"); // simpan status login
    document.getElementById("loginModal").style.display = "none";
    document.querySelector(".main-content").style.display = "block";
  } else {
    alert("Username atau password salah!");
  }
}

function logout() {
  localStorage.removeItem("loggedIn");
  document.getElementById("loginModal").style.display = "block";
  document.querySelector(".main-content").style.display = "none";
}

// ======== UTILITY ========
function val(id) {
  return document.getElementById(id).value.trim();
}

function setVal(id, value) {
  document.getElementById(id).value = value || "";
}

// ======== MODAL HANDLING ========
const modal = document.getElementById("modalBox");
const judulModal = document.getElementById("judulModal");

function bukaModal(mode = "tambah") {
  modal.style.display = "block";
  judulModal.textContent = mode === "edit" ? "Edit Barang" : "Tambah Barang";
}

function tutupModal() {
  modal.style.display = "none";
  resetForm();
}

window.onclick = (e) => {
  if (e.target === modal) tutupModal();
};

function resetForm() {
  [
    "nama",
    "harga",
    "modal",
    "kategori",
    "stok",
    "paket",
    "isiKotak",
    "keterangan",
    "editIndex",
  ].forEach((id) => setVal(id, ""));
}

// ======== FETCH DATA ========
async function ambilData() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Gagal ambil data:", err);
    return [];
  }
}

// ======== TAMPILKAN BARANG ========
//

async function tampilkanBarang(list = null) {
  const tbody = document.getElementById("tabelBarang");
  tbody.innerHTML = "";

  const data = list || (await ambilData());

  data.forEach((b, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${b.nama}</td>
      <td>${b.harga}</td>
      <td>${b.modal}</td>
      <td>${b.kategori}</td>
      <td>${b.stok || "-"}</td>
      <td>${b.paket || "-"}</td>
      <td>${b.isiKotak || "-"}</td>
      <td>${b.keterangan || "-"}</td>
      <td>
        <button onclick="editBarang('${b.id}')">Edit</button>
        <button onclick="hapusBarang('${
          b.id
        }')" style="background:#e53935;">Hapus</button>
      </td>`;
    tbody.appendChild(tr);
  });

  updateKategori(data);
}

// ======== TAMBAH / EDIT ========
async function simpanData() {
  const nama = val("nama");
  const harga = Number(val("harga"));
  const modalHarga = Number(val("modal"));
  const kategori = val("kategori");
  const stok = Number(val("stok"));
  const paket = val("paket");
  const isiKotak = val("isiKotak");
  const keterangan = val("keterangan");
  const editId = val("editIndex");

  if (!nama || !harga || !modalHarga || !kategori) {
    alert("Kolom nama, harga, modal, dan kategori wajib diisi!");
    return;
  }

  const barang = {
    nama,
    harga,
    modal: modalHarga,
    kategori,
    stok,
    paket,
    isiKotak,
    keterangan,
  };

  try {
    if (editId) {
      // update existing
      await fetch(`${API_URL}/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(barang),
      });
    } else {
      // tambah baru
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(barang),
      });
    }
    resetForm();
    tutupModal();
    tampilkanBarang();
  } catch (err) {
    console.error("Gagal simpan data:", err);
  }
}

// ======== EDIT ========
async function editBarang(id) {
  try {
    const res = await fetch(`${API_URL}/${id}`);
    const b = await res.json();
    setVal("editIndex", b.id);
    setVal("nama", b.nama);
    setVal("harga", b.harga);
    setVal("modal", b.modal);
    setVal("kategori", b.kategori);
    setVal("stok", b.stok);
    setVal("paket", b.paket);
    setVal("isiKotak", b.isiKotak);
    setVal("keterangan", b.keterangan);
    bukaModal("edit");
  } catch (err) {
    console.error("Gagal ambil data untuk edit:", err);
  }
}

// ======== HAPUS ========
async function hapusBarang(id) {
  if (!confirm("Yakin hapus barang ini?")) return;
  try {
    await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    tampilkanBarang();
  } catch (err) {
    console.error("Gagal hapus:", err);
  }
}

// ======== PENCARIAN ========
async function pencarianLive() {
  const q = val("cari").toLowerCase();
  const data = await ambilData();
  const hasil = data.filter(
    (b) =>
      b.nama.toLowerCase().includes(q) || b.kategori.toLowerCase().includes(q)
  );
  tampilkanBarang(hasil);
}

// ======== KATEGORI ========
function updateKategori(data) {
  const ul = document.getElementById("daftarKategori");
  const kategoriUnik = [...new Set(data.map((b) => b.kategori))];
  ul.innerHTML = "";
  kategoriUnik.forEach((kat) => {
    const li = document.createElement("li");
    li.textContent = kat;
    li.onclick = () => tampilkanKategori(kat);
    ul.appendChild(li);
  });
}

async function tampilkanKategori(kat) {
  kategoriAktif = kat;
  const data = await ambilData();
  const hasil = data.filter((b) => b.kategori === kat);
  tampilkanBarang(hasil);
}

// ======== EXPORT CSV ========
async function exportCSV() {
  const data = await ambilData();
  const header = "Nama,Harga,Modal,Kategori,Stok,Paket,IsiKotak,Keterangan\n";
  const rows = data
    .map(
      (b) =>
        `${b.nama},${b.harga},${b.modal},${b.kategori},${b.stok},${b.paket},${b.isiKotak},${b.keterangan}`
    )
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data-barang.csv";
  a.click();
}

// ======== INIT ========
document.getElementById("simpanBtn").addEventListener("click", simpanData);
document.getElementById("exportBtn").addEventListener("click", exportCSV);
document
  .getElementById("tampilSemua")
  .addEventListener("click", () => tampilkanBarang());
document
  .getElementById("tambahBarangBtn")
  .addEventListener("click", () => bukaModal("tambah"));

tampilkanBarang();
