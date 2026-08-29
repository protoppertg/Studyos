'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.372/pdf.worker.min.mjs`

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedSubject, setSelectedSubject] = useState<any>(null)
  const [chapters, setChapters] = useState<any[]>([])
  
  const [uploading, setUploading] = useState(false)
  const [aiMessage, setAiMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => { listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (session) fetchSubjects()
  }, [session])

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').order('created_at', { ascending: true })
    if (data) setSubjects(data)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthMessage('Logging in...')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthMessage('Error: ' + error.message)
    else setAuthMessage('Login successful!')
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthMessage('Creating account...')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setAuthMessage('Error: ' + error.message)
    else setAuthMessage('Account created!')
  }

  const handleLogout = async () => { await supabase.auth.signOut() }

  const handleSyllabusUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0 || !session) return

    setUploading(true)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setAiMessage(`[${i + 1}/${files.length}] Reading ${file.name} in browser...`)

      try {
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        let textContent = ''
        
        for (let pg = 1; pg <= pdf.numPages; pg++) {
          const page = await pdf.getPage(pg)
          const text = await page.getTextContent()
          textContent += text.items.map((s: any) => s.str).join(' ') + '\n'
        }

        setAiMessage(`[${i + 1}/${files.length}] AI is analyzing ${file.name}...`)
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textContent })
        })

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Server Error on ${file.name}: ${errorText}`);
        }

        const aiData = await res.json();
        if (aiData.error) throw new Error(aiData.error);

        setAiMessage(`[${i + 1}/${files.length}] Saving ${file.name} to database...`)
        for (const subject of aiData.subjects) {
          const { data: subData } = await supabase
            .from('subjects').insert([{ name: subject.name, user_id: session.user.id }]).select('id').single()
          
          if (subData && subject.chapters) {
            for (const chapter of subject.chapters) {
              const { data: chapData } = await supabase
                .from('chapters').insert([{ name: chapter.name, subject_id: subData.id, user_id: session.user.id }]).select('id').single()
              
              if (chapData && chapter.topics) {
                const topicArray = chapter.topics.map((t: any) => ({
                  name: t.name, chapter_id: chapData.id, user_id: session.user.id
                }))
                await supabase.from('topics').insert(topicArray)
              }
            }
          }
        }
        setAiMessage(`[${i + 1}/${files.length}] ${file.name} completed!`)

      } catch (error: any) {
        setAiMessage(`Error on ${file.name}: ${error.message}`)
      }
    }

    setAiMessage('All files processed!')
    fetchSubjects()
    setUploading(false)
  }

  const openSubject = async (subject: any) => {
    setSelectedSubject(subject)
    const { data } = await supabase.from('chapters').select('*, topics(*)').eq('subject_id', subject.id)
    if (data) setChapters(data)
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-900 p-8 rounded-xl shadow-2xl border border-gray-800">
          <h1 className="text-3xl font-bold text-center text-white mb-2">StudyOS</h1>
          <p className="text-gray-400 text-center mb-8">Your adaptive revision buddy.</p>
          
          <div className="space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            
            <div className="flex gap-2">
              <button onClick={handleLogin} className="flex-1 p-3 rounded-lg bg-blue-600 hover:bg-blue-700 transition text-white font-semibold">Login</button>
              <button onClick={handleSignup} className="flex-1 p-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition text-white font-semibold">Sign Up</button>
            </div>
          </div>
          {authMessage && <p className="mt-6 text-center text-sm text-gray-300">{authMessage}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-2xl sm:text-3xl font-bold">StudyOS</h1>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded">Logout</button>
        </header>

        <div className="bg-gray-900 p-6 rounded-xl shadow-2xl border border-gray-800 mb-8">
          <h2 className="text-xl font-semibold mb-4">Bulk Upload Syllabus</h2>
          <p className="text-gray-400 mb-4">Select multiple PDFs at once. The browser will read them instantly and the AI will extract the data in seconds.</p>
          
          <label className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg text-white font-semibold cursor-pointer transition">
            {uploading ? 'Processing Queue...' : '📎 Select Multiple Syllabus PDFs'}
            <input type="file" accept="application/pdf" multiple className="hidden" onChange={handleSyllabusUpload} disabled={uploading} />
          </label>
          {aiMessage && <p className="mt-4 text-center text-sm text-blue-400 animate-pulse">{aiMessage}</p>}
        </div>

        {!selectedSubject ? (
          <div className="bg-gray-900 p-6 rounded-xl shadow-2xl border border-gray-800">
            <h2 className="text-xl font-semibold mb-4">Extracted Subjects</h2>
            <div className="space-y-3">
              {subjects.length === 0 && <p className="text-gray-500">No subjects yet. Upload your syllabus to begin!</p>}
              {subjects.map((subject) => (
                <button key={subject.id} onClick={() => openSubject(subject)} className="w-full flex justify-between items-center bg-gray-800 p-4 rounded-lg hover:bg-gray-700 transition">
                  <span className="text-lg font-medium">{subject.name}</span>
                  <span className="text-gray-400">View Chapters →</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 p-6 rounded-xl shadow-2xl border border-gray-800">
            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setSelectedSubject(null)} className="text-gray-400 hover:text-white border border-gray-700 px-3 py-1 rounded text-sm">← Back</button>
              <h2 className="text-xl font-semibold">{selectedSubject.name}</h2>
            </div>

            <div className="space-y-4">
              {chapters.length === 0 && <p className="text-gray-500">No chapters found for this subject.</p>}
              {chapters.map((chapter) => (
                <div key={chapter.id} className="bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-blue-400 mb-2">{chapter.name}</h3>
                  {chapter.topics && chapter.topics.length > 0 ? (
                    <ul className="list-disc list-inside text-gray-300 space-y-1 ml-2">
                      {chapter.topics.map((topic: any) => (<li key={topic.id}>{topic.name}</li>))}
                    </ul>
                  ) : (<p className="text-gray-500 text-sm ml-2">No topics extracted.</p>)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
