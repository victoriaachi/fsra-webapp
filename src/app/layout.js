import "./layout.css"; 
import './globals.css'
import Link from "next/link";
 

export const metadata = {
  title: "Parrot-ssistant",
  description: "PDF Comparison & Rate of Return Graph Tool",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="sidebar">
          <img src="/parrot-wave.png"/>
          <h2>Parrot-ssistant</h2> 
          <ul>
            {/* <li><Link href="/">Home</Link></li> */}
            <li><Link href="/compare">AIS vs AVR Comparison</Link></li>
            {/* <li><Link href="/pba">PBA Search</Link></li> */}
            {/* <li><Link href="/feature3">Feature 3</Link></li> */}
            <li><Link href="/ror">Rate of Return Graphs</Link></li>
          </ul>
        </nav>

        <main className="content">
          {children}
        </main>
      </body> 
    </html>
  );
}
 
