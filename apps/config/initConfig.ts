import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
const API_TOKEN = import.meta.env.VITE_APP_API_TOKEN;

const API_URL = `${API_BASE_URL}/app-settings/fetch`;
const HEADERS = {
    token: API_TOKEN,
    "Content-Type": "application/json",
};

export async function initializeAppConfig() {
    const localKey = "project_config";

    // 1️⃣ Check LocalStorage
    const cached = localStorage.getItem(localKey);
    if (cached) {
        const data = JSON.parse(cached);
        window.APP_CONFIG = data;
        return data;
    }

    // 2️⃣ Fetch directly (no external function needed)
    let appSettings = null;

    try {
        const response = await axios.post(API_URL, {}, { headers: HEADERS });
        appSettings = response.data.data.appSetting;
    } catch (e) {
        console.error("Error fetching app settings", e);
    }
    console.log("Appsettings in root", appSettings)
    // 3️⃣ Fall back if API fails
    if (!appSettings) {
        const fallback = {
            projectName: "Default Project",
            logo: "",
            patientlogo: "",
            roundLogo: "",
        };
        window.APP_CONFIG = fallback;
        return fallback;
    }

    const config = {
        projectName: appSettings.appName,
        logo: appSettings.logo,
        patientlogo: appSettings.patientLogo,
        roundLogo: appSettings.roundLogo,
    };

    // 4️⃣ Save to localStorage
    localStorage.setItem(localKey, JSON.stringify(config));

    // 5️⃣ Assign globally
    window.APP_CONFIG = config;

    return config;
}

declare global {
    interface Window {
        APP_CONFIG: {
            projectName: string;
            logo: string;
            patientlogo: string;
            roundLogo: string;
        };
    }
}
