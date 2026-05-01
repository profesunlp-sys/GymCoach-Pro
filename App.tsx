import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import Papa from 'papaparse';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, Legend, PieChart, Pie
} from 'recharts';
import { Alumno, Clase, ViewMode, GrupoConfig, AsistenciaRecord, UserRole, Feedback, Skill, SkillStatus, Apparatus, Source } from './types';
import { processClassAudio, refineClassAnalysis, analyzeAttendanceStats, queryKnowledgeBase } from './services/geminiService';
import { SKILL_TREE, DISCIPLINAS, NIVELES as DEFAULT_NIVELES } from './constants';
import { Button, Tooltip, BackButton, EditableDropdown } from './src/components/ui/CommonUI';
import { db as firestore, auth, googleProvider, COLLECTIONS, getCollectionData, getFilteredCollectionData, addDocument, updateDocument, deleteDocument, getAttendanceByStudent } from './services/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, onSnapshot, orderBy, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
// Lazy loaded components
const Dashboard = lazy(() => import('./src/components/Dashboard').then(module => ({ default: module.Dashboard })));
const Reportes = lazy(() => import('./src/components/Reportes').then(module => ({ default: module.Reportes })));
const Staff = lazy(() => import('./src/components/Staff').then(module => ({ default: module.Staff })));
const Manuales = lazy(() => import('./src/components/Manuales').then(module => ({ default: module.Manuales })));
const Habilidades = lazy(() => import('./src/components/Habilidades').then(module => ({ default: module.Habilidades })));
const Grupos = lazy(() => import('./src/components/Grupos').then(module => ({ default: module.Grupos })));
const Asistencia = lazy(() => import('./src/components/Asistencia').then(module => ({ default: module.Asistencia })));
const Clases = lazy(() => import('./src/components/Clases').then(module => ({ default: module.Clases })));
const Alumnos = lazy(() => import('./src/components/Alumnos'));
const BulkPaymentImport = lazy(() => import('./src/components/BulkPaymentImport').then(module => ({ default: module.BulkPaymentImport })));
const ControlPagos = lazy(() => import('./src/components/ControlPagos').then(module => ({ default: module.ControlPagos })));
const CoordinatorDashboard = lazy(() => import('./src/components/CoordinatorDashboard').then(module => ({ default: module.CoordinatorDashboard })));


const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center p-20 space-y-6">
    <div className="w-12 h-12 border-4 border-ios-blue border-t-transparent rounded-full animate-spin"></div>
    <p className="text-secondary text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse">Cargando Módulo</p>
  </div>
