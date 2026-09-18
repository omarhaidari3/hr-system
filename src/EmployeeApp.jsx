import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
    Clock,
    LogIn,
    LogOut,
    CalendarCheck,
    CheckCircle2,
    AlertTriangle,
    Calendar,
    User,
    ShieldCheck,
    RefreshCw,
    Lock
} from 'lucide-react';

export default function EmployeeApp() {
    const [pin, setPin] = useState('');
    const [authenticatedEmp, setAuthenticatedEmp] = useState(null);
    const [todayLog, setTodayLog] = useState(null);
    const [myLeaves, setMyLeaves] = useState([]);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
    const [loading, setLoading] = useState(false);

    // Toast
    const [toast, setToast] = useState(null);
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    // Clock ticker
    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
        return () => clearInterval(t);
    }, []);

    // Fetch employee attendance & leaves after PIN login
    const fetchEmployeeData = async (emp) => {
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];

            // 1. Fetch Today's Punch Log
            const { data: att } = await supabase
                .from('attendance_logs')
                .select('*')
                .eq('employee_id', emp.id)
                .eq('work_date', today)
                .maybeSingle();
            setTodayLog(att || null);

            // 2. Fetch Recent Leaves
            const { data: leaves } = await supabase
                .from('leave_requests')
                .select('*')
                .eq('employee_id', emp.id)
                .order('created_at', { ascending: false })
                .limit(5);
            setMyLeaves(leaves || []);

            // 3. Refresh Profile Balances
            const { data: freshEmp } = await supabase
                .from('employees')
                .select('*')
                .eq('id', emp.id)
                .single();
            if (freshEmp) setAuthenticatedEmp(freshEmp);

        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Handle PIN Sign-In
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .or(`pin_code.eq.${pin},emp_code.eq.${pin}`)
                .maybeSingle();

            if (error || !data) {
                showToast('Invalid PIN or Employee Code.', 'error');
                setLoading(false);
                return;
            }

            setAuthenticatedEmp(data);
            fetchEmployeeData(data);
            showToast(`Welcome back, ${data.name}!`, 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Handle Virtual Punch
    const handlePunch = async (mode) => {
        if (!authenticatedEmp) return;
        const today = new Date().toISOString().split('T')[0];
        const nowISO = new Date().toISOString();

        try {
            if (mode === 'IN') {
                if (todayLog && todayLog.clock_in) {
                    showToast(`Already clocked in at ${new Date(todayLog.clock_in).toLocaleTimeString()}`, 'error');
                    return;
                }

                const payload = {
                    employee_id: authenticatedEmp.id,
                    employee_name: authenticatedEmp.name,
                    work_date: today,
                    clock_in: nowISO,
                    status: 'Present'
                };

                const { error } = await supabase.from('attendance_logs').upsert([payload], { onConflict: 'employee_id,work_date' });
                if (error) throw error;
                showToast(`Clocked IN successfully at ${new Date().toLocaleTimeString()}!`, 'success');
            } else {
                if (!todayLog || !todayLog.clock_in) {
                    showToast('You must clock in first before clocking out.', 'error');
                    return;
                }

                const inTime = new Date(todayLog.clock_in);
                const outTime = new Date(nowISO);
                const hoursWorked = ((outTime - inTime) / (1000 * 60 * 60)).toFixed(2);

                const { error } = await supabase
                    .from('attendance_logs')
                    .update({
                        clock_out: nowISO,
                        total_hours: parseFloat(hoursWorked)
                    })
                    .eq('id', todayLog.id);

                if (error) throw error;
                showToast(`Clocked OUT! Logged ${hoursWorked} working hours.`, 'success');
            }

            fetchEmployeeData(authenticatedEmp);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // Submit Leave Request
    const handleSubmitLeave = async (form) => {
        try {
            const affectsSalary = form.type === 'Unpaid Leave';
            const payload = {
                employee_id: authenticatedEmp.id,
                employee_name: authenticatedEmp.name,
                employee_avatar: authenticatedEmp.avatar,
                department: authenticatedEmp.department,
                type: form.type,
                affects_salary: affectsSalary,
                start_date: form.start_date,
                end_date: form.end_date,
                days: parseInt(form.days, 10) || 1,
                reason: form.reason,
                status: 'Pending'
            };

            const { error } = await supabase.from('leave_requests').insert([payload]);
            if (error) throw error;

            setShowLeaveModal(false);
            showToast('Leave request submitted to HR & Owner.', 'success');
            fetchEmployeeData(authenticatedEmp);
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
            {/* Header */}
            <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black shadow-lg">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-white leading-tight">Employee Self-Service & Punch</h1>
                        <p className="text-[10px] text-slate-400">Virtual Time Clock</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-emerald-400 font-bold px-3 py-1 bg-emerald-950/50 border border-emerald-800 rounded-lg">
            {currentTime}
          </span>
                    {authenticatedEmp && (
                        <button
                            onClick={() => { setAuthenticatedEmp(null); setPin(''); }}
                            className="text-xs text-slate-400 hover:text-white px-2.5 py-1 bg-slate-800 rounded-lg"
                        >
                            Sign Out
                        </button>
                    )}
                </div>
            </header>

            {/* Main Kiosk Area */}
            <main className="flex-1 flex items-center justify-center p-4">
                {!authenticatedEmp ? (
                    /* Sign-In Card */
                    <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 text-center">
                        <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                            <Lock className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Staff Punch Kiosk</h2>
                            <p className="text-xs text-slate-400 mt-1">Enter your 4-digit PIN or Employee Code</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <input
                                type="password"
                                required
                                maxLength={10}
                                placeholder="••••"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="w-full text-center text-2xl tracking-widest bg-slate-950 border border-slate-800 rounded-xl py-3 text-white font-mono focus:outline-none focus:border-emerald-500"
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg flex items-center justify-center gap-2"
                            >
                                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Enter Portal'}
                            </button>
                        </form>
                    </div>
                ) : (
                    /* Logged In Dashboard */
                    <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
                        {/* Employee Profile Header */}
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-3">
                                <img src={authenticatedEmp.avatar} alt="" className="h-12 w-12 rounded-xl object-cover ring-2 ring-emerald-500" />
                                <div>
                                    <h2 className="text-base font-bold text-white">{authenticatedEmp.name}</h2>
                                    <p className="text-xs text-slate-400">{authenticatedEmp.role} • {authenticatedEmp.department}</p>
                                    <span className="text-[10px] font-mono text-emerald-400">{authenticatedEmp.emp_code}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowLeaveModal(true)}
                                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
                            >
                                Request Vacation
                            </button>
                        </div>

                        {/* Quick Punch Clock Controls */}
                        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4 text-center">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Shift Tracker</span>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => handlePunch('IN')}
                                    className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
                                >
                                    <LogIn className="w-5 h-5" /> Clock In
                                </button>
                                <button
                                    onClick={() => handlePunch('OUT')}
                                    className="py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
                                >
                                    <LogOut className="w-5 h-5" /> Clock Out
                                </button>
                            </div>

                            {/* Status summary */}
                            <div className="grid grid-cols-3 gap-2 pt-2 text-xs border-t border-slate-800/80">
                                <div>
                                    <span className="text-slate-500 block">Arrival:</span>
                                    <span className="font-mono font-bold text-emerald-400">
                    {todayLog?.clock_in ? new Date(todayLog.clock_in).toLocaleTimeString() : 'Not Yet'}
                  </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Departure:</span>
                                    <span className="font-mono font-bold text-rose-400">
                    {todayLog?.clock_out ? new Date(todayLog.clock_out).toLocaleTimeString() : (todayLog?.clock_in ? 'On Shift' : '--')}
                  </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block">Total Hours:</span>
                                    <span className="font-mono font-bold text-white">
                    {todayLog?.total_hours || '0.00'} hrs
                  </span>
                                </div>
                            </div>
                        </div>

                        {/* Balances & Schedule */}
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Annual Paid</span>
                                <span className="text-lg font-black text-emerald-400">{authenticatedEmp.leave_annual}d left</span>
                            </div>
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Sick Leave</span>
                                <span className="text-lg font-black text-indigo-400">{authenticatedEmp.leave_sick}d left</span>
                            </div>
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Unpaid Taken</span>
                                <span className="text-lg font-black text-rose-400">{authenticatedEmp.leave_unpaid_taken}d</span>
                            </div>
                        </div>

                        {/* Recent Time-Off Requests */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">My Leave Applications</h3>
                            {myLeaves.length === 0 ? (
                                <p className="text-xs text-slate-500">No recent leave applications.</p>
                            ) : (
                                myLeaves.map((l) => (
                                    <div key={l.id} className="flex justify-between items-center p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                                        <div>
                                            <span className="font-bold text-white block">{l.type}</span>
                                            <span className="text-slate-500 text-[10px]">{l.start_date} → {l.end_date} ({l.days} days)</span>
                                        </div>
                                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                            l.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400' :
                                                l.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                                        }`}>
                      {l.status}
                    </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Leave Application Modal */}
            {showLeaveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-xs">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
                        <h3 className="text-sm font-bold text-white">Apply for Vacation / Leave</h3>
                        <LeaveForm onSubmit={handleSubmitLeave} onCancel={() => setShowLeaveModal(false)} />
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl text-xs font-semibold shadow-2xl border flex items-center gap-2 ${
                    toast.type === 'error' ? 'bg-rose-950 text-rose-200 border-rose-800' : 'bg-emerald-950 text-emerald-200 border-emerald-800'
                }`}>
                    {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    <span>{toast.msg}</span>
                </div>
            )}
        </div>
    );
}

function LeaveForm({ onSubmit, onCancel }) {
    const [form, setForm] = useState({
        type: 'Annual Leave',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        days: 1,
        reason: ''
    });

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
            <div>
                <label className="text-slate-400 block mb-1">Leave Type</label>
                <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                >
                    <option value="Annual Leave">Paid Annual Vacation</option>
                    <option value="Paid Sick Leave">Paid Sick Leave</option>
                    <option value="Unpaid Leave">Unpaid Leave (Reduces Monthly Salary)</option>
                </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-slate-400 block mb-1">Start Date</label>
                    <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" />
                </div>
                <div>
                    <label className="text-slate-400 block mb-1">End Date</label>
                    <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" />
                </div>
            </div>

            <div>
                <label className="text-slate-400 block mb-1">Total Days</label>
                <input type="number" min="1" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" />
            </div>

            <div>
                <label className="text-slate-400 block mb-1">Reason</label>
                <textarea rows="3" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl">Submit</button>
            </div>
        </form>
    );
}