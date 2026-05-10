# 📦 Foldify

An interactive web-based 3D box builder application designed for the "Computer Engineering Essential Final Project". Foldify allows users to fold 2D nets into 3D boxes, apply custom textures (including AI-generated textures), utilize Computer Vision to scan nets from photos, and save their creations.

## ✨ Features (Mapped to Project Criteria)

### 1. Basic Requirements
*   🔐 **User Authentication:** Secure login, logout, and registration using Firebase Auth. Personal user sessions ensure that creations are tied to individual accounts.
*   🌐 **External API Integration:**
    *   **Hugging Face Inference API:** Powers the AI Texture Generator, allowing users to type a prompt and instantly generate custom seamless textures for their 3D boxes using the `FLUX.1-schnell` model.
*   🚀 **Deployment:** (Provide your Vercel/Firebase Hosted link here!)

### 2. Challenging Requirements
*   🧠 **Tier S - Computer Vision (Smart Scan Net):** Users can upload an image of any valid 2D cube net. The application's custom client-side image processing algorithm scans the image, extracts the topology, and instantly converts it into an interactive 3D model.
*   💾 **Tier B - Saved / Favorites (Gallery System):** Users can save their uniquely customized 3D boxes (with specific textures, shapes, and colors) to a personal Gallery powered by Firebase Firestore. Full CRUD functionality is implemented (Save, Read, Load, Delete).
*   🎨 **Tier C - Theme Toggle:** Full Dark Mode and Light Mode support seamlessly integrated with Tailwind CSS.
*   🔔 **Tier C - Notifications:** Comprehensive Toast Notification system providing instant feedback on user actions (e.g., successful exports, AI generation errors).

### 3. Additional UI/UX Features
*   **Advanced Export Studio:** Export the 3D canvas as a high-quality PNG with a custom transparent background, built-in zooming, panning, and clipboard copy support.
*   **3D Interactive Canvas:** Smooth camera trackball controls, real-time folding animations, and localized texture mapping using `react-three-fiber`.

---

## 🛠️ Technologies Used

*   **Frontend Framework:** React + Vite
*   **3D Rendering:** Three.js, React Three Fiber, React Three Drei
*   **Styling:** Tailwind CSS v4, Lucide React (Icons)
*   **Backend & Auth:** Firebase (Authentication, Firestore)
*   **AI Integration:** Hugging Face Inference API

---

## 🚀 How to Run Locally

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd box-edu-3d
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   * Rename `.env.example` to `.env`
   * Fill in your Firebase configuration details from the Firebase Console.
   * Add your Hugging Face Access Token (`VITE_HUGGINGFACE_TOKEN`) obtained from [Hugging Face Settings](https://huggingface.co/settings/tokens).

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.
