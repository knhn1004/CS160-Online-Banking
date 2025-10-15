import Image from "next/image";
export default function Page() {
  return (
    <main className="min-h-screen flex flex-col bg-gray-50 font-inter">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-24 bg-gradient-to-b from-blue-100 to-white">
        <h1 className="text-5xl font-bold mb-4 text-blue-800 tracking-tight">
          Simple, Secure, and Smart Banking
        </h1>
        <p className="text-lg text-gray-600 mb-10 max-w-2xl">
          Experience next-generation digital banking with Bank160 — secure
          accounts, seamless transfers, and financial tools that work for you.
        </p>
        <div className="flex gap-4">
          <button className="px-6 py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition">
            Get Started
          </button>
          <button className="px-6 py-3 border border-blue-700 text-blue-700 rounded-lg hover:bg-blue-50 transition">
            Learn More
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-6xl mx-auto px-6">
          {/* Feature 1 */}
          <div className="flex flex-col items-center text-center p-8 border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition">
            <div className="w-16 h-16 bg-blue-100 rounded-full mb-4 flex items-center justify-center">
              {/* Replace with icon later */}
            </div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">
              Account Management
            </h3>
            <p className="text-gray-600 mb-4">
              Open or close checking and savings accounts with instant balance
              visibility.
            </p>
            <a href="#" className="text-blue-700 font-medium hover:underline">
              Learn more →
            </a>
          </div>

          {/* Feature 2 */}
          <div className="flex flex-col items-center text-center p-8 border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition">
            <div className="w-16 h-16 bg-blue-100 rounded-full mb-4 flex items-center justify-center">
              {/* Replace with icon later */}
            </div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">
              Automated Bill Pay
            </h3>
            <p className="text-gray-600 mb-4">
              Schedule recurring payments easily and stay on top of your bills.
            </p>
            <a href="#" className="text-blue-700 font-medium hover:underline">
              Learn more →
            </a>
          </div>

          {/* Feature 3 */}
          <div className="flex flex-col items-center text-center p-8 border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition">
            <div className="w-16 h-16 bg-blue-100 rounded-full mb-4 flex items-center justify-center">
              {/* Replace with icon later */}
            </div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">
              ATM Locator
            </h3>
            <p className="text-gray-600 mb-4">
              Locate nearby ATMs with live map integration powered by Google
              Maps.
            </p>
            <a href="#" className="text-blue-700 font-medium hover:underline">
              Learn more →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-100 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} CS160 Bank. All rights reserved.
      </footer>
    </main>
  );
}
