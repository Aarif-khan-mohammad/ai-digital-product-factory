'use client'

import type { Metadata } from 'next'
import { useState } from 'react'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', consent: false })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required.'
    if (!form.email.trim()) e.email = 'Email address is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address.'
    if (!form.message.trim()) e.message = 'Message is required.'
    if (!form.consent) e.consent = 'You must agree before submitting.'
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setStatus('sending')
    // In production, replace with your actual API endpoint
    await new Promise((r) => setTimeout(r, 1000))
    setStatus('sent')
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-20">
      <h1 className="text-3xl font-bold text-white mb-3">Contact</h1>
      <p className="text-slate-400 text-sm mb-10 leading-relaxed">
        Have a question about this project? Use the form below. We only use your contact details
        to respond to your enquiry and will not share them with third parties.
      </p>

      {status === 'sent' ? (
        <div role="alert" className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-6 text-emerald-300 text-sm">
          <p className="font-semibold mb-1">Message received</p>
          <p className="text-emerald-400/80">Thank you for getting in touch. We will respond to your email as soon as possible.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate aria-label="Contact form" className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-slate-400 mb-1.5">
              Full name <span aria-hidden="true" className="text-red-400">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <input
              id="name" type="text" name="name" autoComplete="name"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              aria-required="true" aria-describedby={errors.name ? 'name-error' : undefined}
              aria-invalid={!!errors.name}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-colors"
              placeholder="Your full name"
            />
            {errors.name && <p id="name-error" role="alert" className="mt-1.5 text-xs text-red-400">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-400 mb-1.5">
              Email address <span aria-hidden="true" className="text-red-400">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <input
              id="email" type="email" name="email" autoComplete="email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              aria-required="true" aria-describedby={errors.email ? 'email-error' : undefined}
              aria-invalid={!!errors.email}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-colors"
              placeholder="you@example.com"
            />
            {errors.email && <p id="email-error" role="alert" className="mt-1.5 text-xs text-red-400">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="subject" className="block text-xs font-medium text-slate-400 mb-1.5">
              Subject
            </label>
            <input
              id="subject" type="text" name="subject"
              value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-colors"
              placeholder="What is your enquiry about?"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-xs font-medium text-slate-400 mb-1.5">
              Message <span aria-hidden="true" className="text-red-400">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <textarea
              id="message" name="message" rows={5}
              value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
              aria-required="true" aria-describedby={errors.message ? 'message-error' : undefined}
              aria-invalid={!!errors.message}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-colors resize-y"
              placeholder="Describe your question or issue in detail."
            />
            {errors.message && <p id="message-error" role="alert" className="mt-1.5 text-xs text-red-400">{errors.message}</p>}
          </div>

          {/* DPDP / form consent */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <input
                id="consent" type="checkbox" name="consent"
                checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                aria-required="true" aria-describedby="consent-desc"
                aria-invalid={!!errors.consent}
                className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-slate-900 cursor-pointer"
              />
              <label htmlFor="consent" id="consent-desc" className="text-xs text-slate-400 leading-relaxed cursor-pointer">
                I agree that the information I submit will be used solely to respond to my enquiry,
                in accordance with the{' '}
                <a href="/privacy-policy" className="text-sky-400 underline hover:text-sky-300">Privacy Policy</a>.
                I understand I can request deletion of my data at any time by contacting us.
              </label>
            </div>
            {errors.consent && <p role="alert" className="mt-2 text-xs text-red-400 pl-7">{errors.consent}</p>}
          </div>

          {status === 'error' && (
            <p role="alert" className="text-sm text-red-400">Something went wrong. Please try again.</p>
          )}

          <button
            type="submit"
            disabled={status === 'sending'}
            aria-disabled={status === 'sending'}
            className="w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-950">
            {status === 'sending' ? 'Sending…' : 'Send message'}
          </button>

          <p className="text-xs text-slate-600 text-center">
            Fields marked <span aria-hidden="true" className="text-red-400">*</span>
            <span className="sr-only">with an asterisk</span> are required.
            We do not share your data with third parties.
          </p>
        </form>
      )}
    </div>
  )
}
