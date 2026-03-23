import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { couplesAPI, mergesAPI } from '../../services/api.js';
import IrisUpload from '../IrisUpload/IrisUpload.jsx';
import TemplateGallery from '../TemplateGallery/TemplateGallery.jsx';
import ProductMockups from '../ProductMockups/ProductMockups.jsx';
import toast from 'react-hot-toast';

const STEPS = ['Couple', 'Iris Photos', 'Template', 'Generate', 'Result'];

function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 mb-8 overflow-x-auto no-scrollbar">
      {steps.map((step, i) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center flex-shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
              i < current
                ? 'bg-primary-600 text-white'
                : i === current
                ? 'bg-primary-700 text-white shadow-glow'
                : 'bg-surface-border text-slate-500'
            }`}>
              {i < current ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            <span className={`text-xs mt-1 font-medium transition-colors ${i === current ? 'text-primary-400' : 'text-slate-500'}`}>
              {step}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 flex-1 transition-colors duration-300 ${i < current ? 'bg-primary-600' : 'bg-surface-border'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function NewMerge() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [couples, setCouples] = useState([]);
  const [selectedCouple, setSelectedCouple] = useState(null);
  const [newCoupleMode, setNewCoupleMode] = useState(false);
  const [newCoupleA, setNewCoupleA] = useState('');
  const [newCoupleB, setNewCoupleB] = useState('');
  const [irisFiles, setIrisFiles] = useState({ irisA: null, irisB: null });
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [resultMerge, setResultMerge] = useState(null);

  useEffect(() => {
    couplesAPI.list().then((d) => setCouples(d.couples || [])).catch(() => {});
  }, []);

  async function createCouple() {
    if (!newCoupleA.trim() || !newCoupleB.trim()) {
      toast.error('Both names are required');
      return;
    }
    try {
      const data = await couplesAPI.create({ person_a_name: newCoupleA.trim(), person_b_name: newCoupleB.trim() });
      setCouples((prev) => [data.couple, ...prev]);
      setSelectedCouple(data.couple);
      setNewCoupleMode(false);
      toast.success('Couple created!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create couple');
    }
  }

  async function handleGenerate() {
    if (!selectedCouple || !irisFiles.irisA || !irisFiles.irisB || !selectedTemplate) {
      toast.error('Please complete all steps');
      return;
    }
    setGenerating(true);
    setStep(3);
    try {
      const data = await mergesAPI.create({
        couple_id: selectedCouple.id,
        template_id: selectedTemplate.id,
        irisAFile: irisFiles.irisA,
        irisBFile: irisFiles.irisB,
      });
      setResultMerge(data.merge);
      setStep(4);
      toast.success('Iris merge generated!');
    } catch (err) {
      const message = err.response?.data?.error || 'Generation failed';
      toast.error(message);
      setStep(2); // go back to template selection
    } finally {
      setGenerating(false);
    }
  }

  const canProceedStep = () => {
    switch (step) {
      case 0: return !!selectedCouple;
      case 1: return !!(irisFiles.irisA && irisFiles.irisB);
      case 2: return !!selectedTemplate;
      default: return true;
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-slide-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">New Iris Merge</h1>
        <p className="text-slate-400 text-sm mt-1">Create an AI-generated iris artwork for a couple</p>
      </div>

      <StepIndicator current={step} steps={STEPS} />

      <AnimatePresence mode="wait">
        {/* Step 0: Select couple */}
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="card space-y-4">
            <h2 className="text-lg font-semibold text-slate-100">Select Couple</h2>

            {!newCoupleMode ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                  {couples.map((couple) => (
                    <button
                      key={couple.id}
                      onClick={() => setSelectedCouple(couple)}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                        selectedCouple?.id === couple.id
                          ? 'border-primary-500 bg-primary-900/20'
                          : 'border-surface-border hover:border-primary-700/50 hover:bg-surface-border/50'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-700 to-accent-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {couple.person_a_name[0]}{couple.person_b_name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">{couple.person_a_name}</p>
                        <p className="text-sm text-slate-400">& {couple.person_b_name}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {couples.length === 0 && (
                  <p className="text-slate-500 text-sm">No couples yet. Create a new one below.</p>
                )}
                <button
                  onClick={() => setNewCoupleMode(true)}
                  className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Couple
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <input className="input-field" placeholder="Person A name" value={newCoupleA} onChange={(e) => setNewCoupleA(e.target.value)} />
                <input className="input-field" placeholder="Person B name" value={newCoupleB} onChange={(e) => setNewCoupleB(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={() => setNewCoupleMode(false)} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={createCouple} className="btn-primary flex-1">Create & Select</button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep(1)}
                disabled={!canProceedStep()}
                className="btn-primary"
              >
                Next: Upload Irises
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 1: Upload iris photos */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="card space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Upload Iris Photos</h2>
              <p className="text-slate-400 text-sm mt-1">
                For {selectedCouple?.person_a_name} & {selectedCouple?.person_b_name}
              </p>
            </div>
            <IrisUpload onFilesChange={setIrisFiles} />
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(0)} className="btn-secondary">Back</button>
              <button onClick={() => setStep(2)} disabled={!canProceedStep()} className="btn-primary">
                Next: Choose Template
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Select template */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="card space-y-4">
            <h2 className="text-lg font-semibold text-slate-100">Choose Artistic Style</h2>
            <TemplateGallery selectedTemplate={selectedTemplate} onSelect={setSelectedTemplate} />
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className="btn-secondary">Back</button>
              <button
                onClick={handleGenerate}
                disabled={!canProceedStep() || generating}
                className="btn-primary flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Generate Merge
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Generating */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card text-center py-20 space-y-6">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-primary-900 animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary-700 to-accent-600 flex items-center justify-center animate-spin-slow">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold gradient-text">Generating Iris Art</h2>
              <p className="text-slate-400 text-sm mt-2">
                AI is merging the irises with the {selectedTemplate?.name} style...
              </p>
              <p className="text-slate-500 text-xs mt-1">This may take 30–90 seconds</p>
            </div>
            <div className="flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 4: Result */}
        {step === 4 && resultMerge && (
          <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold gradient-text">Merge Complete!</h2>
                  <p className="text-slate-400 text-sm">
                    {selectedCouple?.person_a_name} & {selectedCouple?.person_b_name} · {selectedTemplate?.name}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/admin/history')}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  View History
                </button>
              </div>

              {resultMerge.result_image_url && (
                <img
                  src={resultMerge.result_image_url}
                  alt="Generated iris merge"
                  className="w-full max-h-96 object-contain rounded-xl mb-4"
                />
              )}
            </div>

            {/* Product mockups */}
            {resultMerge.result_image_url && (
              <ProductMockups imageUrl={resultMerge.result_image_url} />
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep(0);
                  setSelectedCouple(null);
                  setIrisFiles({ irisA: null, irisB: null });
                  setSelectedTemplate(null);
                  setResultMerge(null);
                }}
                className="btn-secondary flex-1"
              >
                New Merge
              </button>
              <button onClick={() => navigate('/admin/history')} className="btn-primary flex-1">
                View All History
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
