import axios from "axios";

console.log("meta", import.meta)
const API_URL = `http://localhost:3006/api/v1/app-settings/fetch`;
const HEADERS = {
    token: "XEF+34543TRerg$",
    "project-id": "1ecf5faf-88d4-44c6-952c-1f4059366997",
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
