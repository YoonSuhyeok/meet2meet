import "@/src/app/styles/global.css";
import { NavBar } from "@/src/widgets/nav-bar";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="mx-auto min-h-screen max-w-3xl px-4 py-8">
            <NavBar />
            {children}
        </div>
    );
}
