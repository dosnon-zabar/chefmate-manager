export default function Page() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-brun">Documentation</h1>
        <p className="text-sm text-brun-light mt-1">Documentation interne de la plateforme</p>
      </header>
      <div className="bg-white rounded-2xl p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-creme flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-brun-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <p className="text-brun-light text-sm">Cette section sera disponible prochainement.</p>
      </div>
    </div>
  )
}
