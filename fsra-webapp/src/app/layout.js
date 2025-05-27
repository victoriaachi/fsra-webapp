import "./layout.css";  // import your CSS file
import Link from "next/link";
 

export const metadata = {
  title: "FSRA Webapp",
  description: "PDF Comparison & Pension Legislation Tool",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="sidebar">
          <h2>Dashboard</h2>
          <ul>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/comparer">AIS vs AVR Compare Tool</Link></li>
            <li><Link href="/pba">PBA Search</Link></li>
            <li><Link href="/feature3">Feature 3</Link></li>
          </ul>
        </nav>

        <main className="content">
          {children}
        </main>
      </body> 
    </html>
  );
}
 
