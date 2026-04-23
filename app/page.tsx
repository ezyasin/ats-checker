'use client';

import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[--bg-primary] text-[--text-primary]">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">ATS Checker</h1>
          <div className="hidden sm:flex items-center gap-12">
            <a href="#features" className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
              How it works
            </a>
          </div>
          <button
            onClick={() => router.push('/analyze')}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer"
          >
            Analyze Now
          </button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-6">
            Beat the ATS
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 leading-relaxed mb-10">
            Match your resume to a real job post with AI-powered analysis.
            See exactly what changes boost your ATS score for that role.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/analyze')}
              className="px-8 py-3.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 shadow-md hover:shadow-lg text-base cursor-pointer"
            >
              Start Free Analysis
            </button>
            <button
              onClick={() => router.push('#features')}
              className="px-8 py-3.5 border-2 border-gray-300 text-gray-900 font-semibold rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 text-base cursor-pointer"
            >
              Learn More
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-6">
            No credit card required. Results in under 2 seconds.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-gray-50 border-t border-b border-gray-200 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="text-5xl font-bold text-blue-600 mb-3">98%</div>
              <p className="text-base font-semibold text-gray-900 mb-1">Accuracy</p>
              <p className="text-sm text-gray-600">Catches ATS-blocking keywords</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-blue-600 mb-3">&lt;2s</div>
              <p className="text-base font-semibold text-gray-900 mb-1">Analysis Speed</p>
              <p className="text-sm text-gray-600">Lightning-fast results</p>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-blue-600 mb-3">100%</div>
              <p className="text-base font-semibold text-gray-900 mb-1">Private</p>
              <p className="text-sm text-gray-600">No data storage</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Comprehensive Resume Analysis
          </h3>
          <p className="text-lg text-gray-600">
            Everything you need to optimize your resume for ATS systems
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { title: 'ATS Score', desc: 'Detailed 0-100 compatibility score' },
            { title: 'Keyword Analysis', desc: 'Missing keywords highlighted' },
            { title: 'Smart Suggestions', desc: 'Actionable text improvements' },
            { title: 'Section Breakdown', desc: 'Score by resume section' },
            { title: 'CV Export', desc: 'Download optimized DOCX file' },
            { title: 'Privacy First', desc: 'Zero data retention' }
          ].map((feature) => (
            <div
              key={feature.title}
              className="p-6 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-lg hover:bg-blue-50/40 transition-all duration-200"
            >
              <h4 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h4>
              <p className="text-sm text-gray-600">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-gray-50 border-t border-b border-gray-200 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h3>
            <p className="text-lg text-gray-600">
              Three simple steps to better results
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { num: '1', title: 'Upload CV', desc: 'Share your resume' },
              { num: '2', title: 'Paste Job Post', desc: 'Add the target job description' },
              { num: '3', title: 'Get Score', desc: 'Instant ATS analysis' }
            ].map((step) => (
              <div key={step.num} className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white font-bold text-lg mb-4">
                  {step.num}
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h4>
                <p className="text-sm text-gray-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32 text-center">
        <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
          Ready for a better resume?
        </h3>
        <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
          Join thousands using ATS Checker to improve their applications
        </p>
        <button
          onClick={() => router.push('/analyze')}
          className="px-8 py-3.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 shadow-md hover:shadow-lg text-base cursor-pointer"
        >
          Start Analyzing Now
        </button>
      </section>
    </main>
  );
}
