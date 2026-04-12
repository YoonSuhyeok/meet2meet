import "@/src/app/styles/global.css";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="mx-auto min-h-screen max-w-3xl px-4 py-8">
            {children}
        </div>
    );
}
