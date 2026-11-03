import { ClientProvider } from "@solana/react";
import App from "./app/App";
import { Toaster } from "./app/components/ui/sonner";
import { solanaClient } from "./app/solana/client";
import { LanguageProvider } from "./app/i18n/LanguageContext";
export default function LegacyRoot() { return <LanguageProvider><ClientProvider client={solanaClient}><App /><Toaster theme="dark" position="top-right" richColors closeButton /></ClientProvider></LanguageProvider>; }
