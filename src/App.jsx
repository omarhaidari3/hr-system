import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  Users,
  UserPlus,
  CalendarCheck,
  DollarSign,
  TrendingUp,
  Clock,
  Shield,
  CheckCircle2,
  RefreshCw,
  X,
  Bell,
  Cake,
  MessageSquare,
  Send,
  Image as ImageIcon,
  HandCoins,
  Menu,
  Pencil,
  Trash2,
  Upload
} from 'lucide-react';

const DEPARTMENTS = [
  'All Departments',
  'Engineering',
  'Operations & Field',
  'Legal & Compliance',
  'Finance & Accounting',
  'Product & Quality',
  'Logistics & Supply'
];

export default function App() {
  const [activeTab, setActiveTab] = useState('attendance');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [punchEvents, setPunchEvents] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [generalRequests, setGeneralRequests] = useState([]);

  // Direct Chat
  const [selectedChatEmp, setSelectedChatEmp] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editInput, setEditInput] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef(null);
  const chatFileRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [timesheetMode, setTimesheetMode] = useState('summary');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All Departments');

  // Modals & Drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showPayslipModal, setShowPayslipModal] = useState(null);

  // Live Notifications
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // Decision Modals
  const [leaveDecisionModal, setLeaveDecisionModal] = useState(null);
  const [leaveDecisionNote, setLeaveDecisionNote] = useState('');
  const [requestDecisionModal, setRequestDecisionModal] = useState(null);
  const [requestDecisionNote, setRequestDecisionNote] = useState('');

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3800);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      const [empRes, attRes, punchRes, leaveRes, genRes] = await Promise.all([
        supabase.from('employees').select('*').order('created_at', { ascending: false }),
        supabase.from('attendance_logs').select('*').eq('work_date', today),
        supabase.from('punch_events').select('*').eq('work_date', today).order('punched_at', { ascending: false }),
        supabase.from('leave_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('general_requests').select('*').order('created_at', { ascending: false })
      ]);

      if (empRes.error) throw empRes.error;
      const empData = empRes.data || [];
      setEmployees(empData);
      setAttendanceLogs(attRes.data || []);
      setPunchEvents(punchRes.data || []);
      setLeaveRequests(leaveRes.data || []);
      setGeneralRequests(genRes.data || []);

      if (empData.length > 0 && !selectedChatEmp) {
        setSelectedChatEmp(empData[0]);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
        .channel('hr-enterprise-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'punch_events' }, (payload) => {
          const ev = payload.new;
          setPunchEvents((prev) => [ev, ...prev]);
          setNotifications((prev) => [
            {
              id: ev.id,
              title: `Punch ${ev.punch_type}`,
              message: `${ev.employee_name} clocked ${ev.punch_type} at ${new Date(ev.punched_at).toLocaleTimeString()}`,
              time: new Date().toLocaleTimeString()
            },
            ...prev
          ]);
          setUnreadCount((c) => c + 1);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
          const today = new Date().toISOString().split('T')[0];
          supabase.from('attendance_logs').select('*').eq('work_date', today)
              .then(({ data }) => setAttendanceLogs(data || []));
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
          supabase.from('leave_requests').select('*').order('created_at', { ascending: false })
              .then(({ data }) => setLeaveRequests(data || []));
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'general_requests' }, () => {
          supabase.from('general_requests').select('*').order('created_at', { ascending: false })
              .then(({ data }) => setGeneralRequests(data || []));
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const msg = payload.new;
            if (selectedChatEmp && msg.employee_id === selectedChatEmp.id) {
              setChatMessages((prev) => [...prev, msg]);
            }
            if (msg.sender === 'EMPLOYEE') {
              showToast(`New message from ${msg.sender_name}`, 'info');
            }
          } else if (payload.eventType === 'UPDATE') {
            setChatMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
          }
        })
        .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChatEmp]);

  useEffect(() => {
    if (!selectedChatEmp) return;
    supabase
        .from('chat_messages')
        .select('*')
        .eq('employee_id', selectedChatEmp.id)
        .order('created_at', { ascending: true })
        .then(({ data, error }) => {
          if (!error) setChatMessages(data || []);
        });
  }, [selectedChatEmp]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!selectedChatEmp || !chatInput.trim()) return;

    const payload = {
      employee_id: selectedChatEmp.id,
      sender: 'HR',
      sender_name: 'HR Management',
      text: chatInput.trim(),
      photo_url: null,
      is_deleted: false,
      is_edited: false
    };

    const textToSend = chatInput;
    setChatInput('');

    const { error } = await supabase.from('chat_messages').insert([payload]);
    if (error) {
      setChatInput(textToSend);
      showToast(error.message, 'error');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChatEmp) return;

    setUploadingFile(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `hr_${selectedChatEmp.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(fileName);

      const payload = {
        employee_id: selectedChatEmp.id,
        sender: 'HR',
        sender_name: 'HR Management',
        text: null,
        photo_url: publicUrlData.publicUrl,
        is_deleted: false,
        is_edited: false
      };

      const { error: insertError } = await supabase.from('chat_messages').insert([payload]);
      if (insertError) throw insertError;
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploadingFile(false);
      if (chatFileRef.current) chatFileRef.current.value = '';
    }
  };

  const handleStartEdit = (msg) => {
    setEditingMessageId(msg.id);
    setEditInput(msg.text || '');
  };

  const handleSaveEdit = async (id) => {
    if (!editInput.trim()) return;
    const { error } = await supabase
        .from('chat_messages')
        .update({ text: editInput.trim(), is_edited: true })
        .eq('id', id);

    if (error) {
      showToast(error.message, 'error');
    } else {
      setEditingMessageId(null);
      setEditInput('');
    }
  };

  const handleDeleteMessage = async (id) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    const { error } = await supabase
        .from('chat_messages')
        .update({
          text: 'This message was deleted',
          photo_url: null,
          is_deleted: true
        })
        .eq('id', id);

    if (error) showToast(error.message, 'error');
  };

  const handleSaveEmployee = async (formData) => {
    try {
      const payload = {
        ...formData,
        emp_code: formData.emp_code.trim().toUpperCase(),
        email: formData.email.trim().toLowerCase(),
        salary: parseFloat(formData.salary) || 0,
        leave_annual: parseInt(formData.leave_annual, 10) || 21,
        leave_sick: parseInt(formData.leave_sick, 10) || 14,
        is_activated: true
      };

      if (editingEmployee) {
        const { error } = await supabase.from('employees').update(payload).eq('id', editingEmployee.id);
        if (error) throw error;
        showToast(`Updated profile for ${payload.name}`);
      } else {
        payload.leave_unpaid_taken = 0;
        payload.status = 'Active';
        if (!payload.avatar) {
          payload.avatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
        }
        const { error } = await supabase.from('employees').insert([payload]);
        if (error) throw error;
        showToast(`Staff member ${payload.name} onboarded!`);
      }

      setShowAddModal(false);
      setEditingEmployee(null);
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleLeaveDecision = async (e) => {
    e.preventDefault();
    const { req, action } = leaveDecisionModal;
    const finalStatus = action === 'Approve' ? 'Approved' : 'Declined';

    try {
      const { error } = await supabase
          .from('leave_requests')
          .update({
            status: finalStatus,
            hr_notes: leaveDecisionNote.trim() || (action === 'Approve' ? 'Approved by HR' : 'Declined by HR')
          })
          .eq('id', req.id);

      if (error) throw error;

      if (action === 'Approve') {
        const emp = employees.find((item) => item.id === req.employee_id);
        if (emp) {
          let upd = {};
          if (req.type === 'Annual Vacation') upd.leave_annual = Math.max(0, (emp.leave_annual || 0) - req.days);
          else if (req.type === 'Medical / Sick Leave') upd.leave_sick = Math.max(0, (emp.leave_sick || 0) - req.days);
          else if (req.type === 'Unpaid Leave') upd.leave_unpaid_taken = (emp.leave_unpaid_taken || 0) + req.days;
          await supabase.from('employees').update(upd).eq('id', emp.id);
        }
      }

      showToast(`Leave request ${finalStatus}.`);
      setLeaveDecisionModal(null);
      setLeaveDecisionNote('');
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRequestDecision = async (e) => {
    e.preventDefault();
    const { req, action } = requestDecisionModal;
    const finalStatus = action === 'Approve' ? 'Approved' : 'Declined';

    try {
      const { error } = await supabase
          .from('general_requests')
          .update({
            status: finalStatus,
            hr_feedback: requestDecisionNote.trim() || (action === 'Approve' ? 'Approved by HR' : 'Declined by HR')
          })
          .eq('id', req.id);

      if (error) throw error;

      if (action === 'Approve' && req.category === 'Salary Increase' && req.amount > 0) {
        await supabase.from('employees').update({ salary: parseFloat(req.amount) }).eq('id', req.employee_id);
      }

      showToast(`Request ${finalStatus}.`);
      setRequestDecisionModal(null);
      setRequestDecisionNote('');
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const birthdaysToday = useMemo(() => {
    const today = new Date();
    const curM = today.getMonth() + 1;
    const curD = today.getDate();

    return employees.filter((emp) => {
      if (!emp.birth_date) return false;
      const bDate = new Date(emp.birth_date);
      return bDate.getMonth() + 1 === curM && bDate.getDate() === curD;
    });
  }, [employees]);

  const punchSummary = useMemo(() => {
    const summaryMap = {};
    punchEvents.forEach((ev) => {
      if (!summaryMap[ev.employee_id]) {
        summaryMap[ev.employee_id] = {
          employee_id: ev.employee_id,
          employee_name: ev.employee_name,
          count: 0,
          events: []
        };
      }
      summaryMap[ev.employee_id].count += 1;
      summaryMap[ev.employee_id].events.push(ev);
    });

    return Object.values(summaryMap).map((item) => {
      const sorted = [...item.events].sort((a, b) => new Date(a.punched_at) - new Date(b.punched_at));
      const firstIn = sorted.find((e) => e.punch_type === 'IN');
      const outs = sorted.filter((e) => e.punch_type === 'OUT');
      const lastOut = outs.length > 0 ? outs[outs.length - 1] : null;

      return {
        ...item,
        first_in: firstIn ? firstIn.punched_at : null,
        last_out: lastOut ? lastOut.punched_at : null
      };
    });
  }, [punchEvents]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = searchQuery.toLowerCase();
      const match =
          (emp.name || '').toLowerCase().includes(q) ||
          (emp.emp_code || '').toLowerCase().includes(q);
      const dept = selectedDept === 'All Departments' || emp.department === selectedDept;
      return match && dept;
    });
  }, [employees, searchQuery, selectedDept]);

  const totalPayroll = employees.reduce((sum, e) => sum + (parseFloat(e.salary) || 0), 0);
  const clockedInToday = attendanceLogs.filter((a) => a.clock_in && !a.clock_out).length;
  const pendingLeaves = leaveRequests.filter((l) => l.status === 'Pending').length;
  const pendingGeneral = generalRequests.filter((r) => r.status === 'Pending').length;

  const formatMessageDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
      <div className="flex h-screen w-full bg-slate-950 font-sans text-slate-100 antialiased overflow-hidden select-none">
        {/* Sidebar Navigation */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div>
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-base font-black text-white tracking-tight">Executive<span className="text-indigo-400">HR</span></span>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-3.5 py-4 space-y-1 text-xs font-semibold">
              <button onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>
                <TrendingUp className="w-4 h-4" /> Overview Dashboard
              </button>
              <button onClick={() => { setActiveTab('employees'); setMobileMenuOpen(false); }} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer ${activeTab === 'employees' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>
                <div className="flex items-center gap-3"><Users className="w-4 h-4" /> Directory</div>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full font-mono">{employees.length}</span>
              </button>
              <button onClick={() => { setActiveTab('attendance'); setMobileMenuOpen(false); }} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer ${activeTab === 'attendance' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>
                <div className="flex items-center gap-3"><Clock className="w-4 h-4" /> Punches</div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">{punchEvents.length} Logs</span>
              </button>
              <button onClick={() => { setActiveTab('leaves'); setMobileMenuOpen(false); }} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer ${activeTab === 'leaves' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>
                <div className="flex items-center gap-3"><CalendarCheck className="w-4 h-4" /> Leaves</div>
                {pendingLeaves > 0 && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">{pendingLeaves}</span>}
              </button>
              <button onClick={() => { setActiveTab('requests'); setMobileMenuOpen(false); }} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer ${activeTab === 'requests' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>
                <div className="flex items-center gap-3"><HandCoins className="w-4 h-4" /> Inquiries</div>
                {pendingGeneral > 0 && <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full font-bold">{pendingGeneral}</span>}
              </button>
              <button onClick={() => { setActiveTab('payroll'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer ${activeTab === 'payroll' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>
                <DollarSign className="w-4 h-4" /> Payroll
              </button>
              <button onClick={() => { setActiveTab('chat'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer ${activeTab === 'chat' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}>
                <MessageSquare className="w-4 h-4" /> Direct Chat
              </button>
            </div>
          </div>

          <div className="p-4 border-t border-slate-800 text-xs text-slate-400 flex justify-between items-center">
            <span className="flex items-center gap-2 text-[11px]"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live DB Online</span>
            <button onClick={fetchData} className="p-1 hover:text-white"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </aside>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
          <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 text-slate-400 hover:text-white">
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-sm sm:text-base font-bold text-white capitalize truncate">
                {activeTab} Management
              </h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative">
                <button
                    onClick={() => { setShowNotifications(!showNotifications); setUnreadCount(0); }}
                    className="relative p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                  )}
                </button>

                {showNotifications && (
                    <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 p-4 space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <h4 className="font-bold text-xs text-white">Live Punch Activity</h4>
                        <button onClick={() => setNotifications([])} className="text-[10px] text-slate-400 hover:text-white">Clear</button>
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {notifications.length === 0 ? (
                            <p className="text-[11px] text-slate-500 text-center py-4">No new notifications.</p>
                        ) : (
                            notifications.map((n, idx) => (
                                <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-0.5">
                                  <p className="font-bold text-white text-[11px]">{n.title}</p>
                                  <p className="text-slate-400 text-[11px]">{n.message}</p>
                                  <span className="text-[9px] text-slate-500">{n.time}</span>
                                </div>
                            ))
                        )}
                      </div>
                    </div>
                )}
              </div>

              <button onClick={() => { setEditingEmployee(null); setShowAddModal(true); }} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg">
                <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Onboard</span> Staff
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
            {birthdaysToday.length > 0 && (
                <div className="bg-gradient-to-r from-amber-500/15 via-pink-500/15 to-indigo-500/15 border border-amber-500/40 p-4 rounded-2xl flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shadow-md font-bold">
                      <Cake className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase text-amber-300 tracking-wider">Birthday Celebration Today</h3>
                      <p className="text-xs text-white">Today is the birthday of: <strong className="text-amber-200">{birthdaysToday.map((b) => b.name).join(', ')}</strong>! 🎉</p>
                    </div>
                  </div>
                </div>
            )}

            {/* TAB 1: PUNCH DATA SHEET */}
            {activeTab === 'attendance' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setTimesheetMode('summary')} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${timesheetMode === 'summary' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        Daily Summary
                      </button>
                      <button onClick={() => setTimesheetMode('raw')} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${timesheetMode === 'raw' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        Raw Punch Stream
                      </button>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">Today's Total: <strong className="text-white">{punchEvents.length}</strong></span>
                  </div>

                  {timesheetMode === 'summary' ? (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto text-xs">
                        <table className="w-full text-left border-collapse text-slate-300 min-w-[600px]">
                          <thead>
                          <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-bold text-slate-400 uppercase">
                            <th className="p-3.5">Employee</th>
                            <th className="p-3.5">Punches Logged</th>
                            <th className="p-3.5">First In</th>
                            <th className="p-3.5">Last Out</th>
                            <th className="p-3.5">Date</th>
                          </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                          {punchSummary.length === 0 ? (
                              <tr><td colSpan="5" className="text-center py-6 text-slate-500">No punches recorded today.</td></tr>
                          ) : (
                              punchSummary.map((item) => (
                                  <tr key={item.employee_id} className="hover:bg-slate-800/40">
                                    <td className="p-3.5 font-bold text-white">{item.employee_name}</td>
                                    <td className="p-3.5 font-mono text-indigo-400 font-bold">{item.count} times</td>
                                    <td className="p-3.5 font-mono text-emerald-400 font-bold">{item.first_in ? new Date(item.first_in).toLocaleTimeString() : '--'}</td>
                                    <td className="p-3.5 font-mono text-rose-400 font-bold">{item.last_out ? new Date(item.last_out).toLocaleTimeString() : 'On Shift'}</td>
                                    <td className="p-3.5 text-slate-400">{new Date().toISOString().split('T')[0]}</td>
                                  </tr>
                              ))
                          )}
                          </tbody>
                        </table>
                      </div>
                  ) : (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto text-xs">
                        <table className="w-full text-left border-collapse text-slate-300 min-w-[500px]">
                          <thead>
                          <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-bold text-slate-400 uppercase">
                            <th className="p-3.5">Employee</th>
                            <th className="p-3.5">Action</th>
                            <th className="p-3.5">Timestamp</th>
                            <th className="p-3.5">Date</th>
                          </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                          {punchEvents.map((ev) => (
                              <tr key={ev.id} className="hover:bg-slate-800/40">
                                <td className="p-3.5 font-bold text-white">{ev.employee_name}</td>
                                <td className="p-3.5">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${ev.punch_type === 'IN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                              Clock {ev.punch_type}
                            </span>
                                </td>
                                <td className="p-3.5 font-mono text-white">{new Date(ev.punched_at).toLocaleTimeString()}</td>
                                <td className="p-3.5 text-slate-400">{ev.work_date}</td>
                              </tr>
                          ))}
                          </tbody>
                        </table>
                      </div>
                  )}
                </div>
            )}

            {/* TAB 2: DIRECT CHAT (DATE, EDIT, DELETE & PHOTO UPLOAD) */}
            {activeTab === 'chat' && (
                <div className="flex flex-col md:flex-row h-[75vh] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col bg-slate-950/60 max-h-48 md:max-h-full">
                    <div className="p-3 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase">Staff List</div>
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
                      {employees.map((e) => (
                          <button
                              key={e.id}
                              onClick={() => setSelectedChatEmp(e)}
                              className={`w-full p-3 text-left flex items-center gap-3 transition ${selectedChatEmp?.id === e.id ? 'bg-indigo-600/20 border-l-4 border-indigo-500' : 'hover:bg-slate-800/40'}`}
                          >
                            <img src={e.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                            <div className="truncate">
                              <p className="text-xs font-bold text-white truncate">{e.name}</p>
                              <span className="text-[10px] text-indigo-400 font-mono">{e.emp_code}</span>
                            </div>
                          </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-between bg-slate-900/40 overflow-hidden">
                    {selectedChatEmp ? (
                        <>
                          <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
                            <div className="truncate">
                              <h4 className="font-bold text-sm text-white truncate">{selectedChatEmp.name}</h4>
                              <span className="text-[10px] text-indigo-400 font-mono">{selectedChatEmp.emp_code}</span>
                            </div>
                          </div>

                          <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {chatMessages.length === 0 ? (
                                <p className="text-center text-xs text-slate-500 py-10">No messages yet with {selectedChatEmp.name}.</p>
                            ) : (
                                chatMessages.map((m) => {
                                  const isHR = m.sender === 'HR';
                                  const isEditing = editingMessageId === m.id;

                                  return (
                                      <div key={m.id} className={`flex flex-col group ${isHR ? 'items-end' : 'items-start'}`}>
                                        <div className={`relative max-w-xs sm:max-w-md p-3 rounded-2xl text-xs space-y-1.5 shadow-md ${
                                            m.is_deleted
                                                ? 'bg-slate-800/50 text-slate-500 italic border border-slate-800'
                                                : isHR
                                                    ? 'bg-indigo-600 text-white rounded-tr-none'
                                                    : 'bg-slate-800 text-slate-200 rounded-tl-none'
                                        }`}>
                                          {isEditing ? (
                                              <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    value={editInput}
                                                    onChange={(e) => setEditInput(e.target.value)}
                                                    className="w-full bg-slate-900 text-white p-2 rounded-lg border border-slate-700 outline-none text-xs"
                                                />
                                                <div className="flex justify-end gap-2 text-[10px]">
                                                  <button onClick={() => setEditingMessageId(null)} className="px-2 py-1 bg-slate-700 rounded">Cancel</button>
                                                  <button onClick={() => handleSaveEdit(m.id)} className="px-2 py-1 bg-emerald-600 font-bold rounded">Save</button>
                                                </div>
                                              </div>
                                          ) : (
                                              <>
                                                <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                                                {m.photo_url && (
                                                    <a href={m.photo_url} target="_blank" rel="noreferrer" className="block mt-1">
                                                      <img
                                                          src={m.photo_url}
                                                          alt="Attachment"
                                                          className="rounded-xl max-h-52 w-auto object-cover border border-white/20 hover:opacity-95 transition"
                                                      />
                                                    </a>
                                                )}
                                              </>
                                          )}

                                          {/* Edit & Delete Controls for HR */}
                                          {isHR && !m.is_deleted && !isEditing && (
                                              <div className="absolute top-1 -left-14 hidden group-hover:flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-1 shadow-lg">
                                                {m.text && (
                                                    <button onClick={() => handleStartEdit(m)} title="Edit Message" className="p-1 hover:text-indigo-400 text-slate-400">
                                                      <Pencil className="w-3 h-3" />
                                                    </button>
                                                )}
                                                <button onClick={() => handleDeleteMessage(m.id)} title="Delete Message" className="p-1 hover:text-rose-400 text-slate-400">
                                                  <Trash2 className="w-3 h-3" />
                                                </button>
                                              </div>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-1.5 text-[9px] text-slate-500 mt-1 px-1">
                                          <span>{formatMessageDate(m.created_at)}</span>
                                          {m.is_edited && !m.is_deleted && <span className="italic text-indigo-400 font-medium">(edited)</span>}
                                        </div>
                                      </div>
                                  );
                                })
                            )}
                            <div ref={messagesEndRef} />
                          </div>

                          <form onSubmit={sendChatMessage} className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
                            <input
                                type="file"
                                accept="image/*"
                                ref={chatFileRef}
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            <button
                                type="button"
                                disabled={uploadingFile}
                                onClick={() => chatFileRef.current?.click()}
                                title="Upload Photo from Device"
                                className="p-2 sm:p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 disabled:opacity-50 transition"
                            >
                              <ImageIcon className={`w-4 h-4 ${uploadingFile ? 'animate-pulse text-indigo-400' : ''}`} />
                            </button>
                            <input
                                type="text"
                                placeholder={uploadingFile ? 'Uploading attachment...' : 'Write a message...'}
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 sm:py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                            />
                            <button type="submit" className="p-2 sm:p-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold transition">
                              <Send className="w-4 h-4" />
                            </button>
                          </form>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-xs text-slate-500">Select an employee to chat.</div>
                    )}
                  </div>
                </div>
            )}

            {/* TAB 3: PERSONNEL DIRECTORY */}
            {activeTab === 'employees' && (
                <div className="space-y-4">
                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                    <input
                        type="text"
                        placeholder="Search name or access code..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full sm:w-80 px-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                    <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300">
                      {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto text-xs">
                    <table className="w-full text-left border-collapse text-slate-300">
                      <thead>
                      <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-bold text-slate-400 uppercase">
                        <th className="p-3.5">Employee</th>
                        <th className="p-3.5">Access Code</th>
                        <th className="p-3.5">Email</th>
                        <th className="p-3.5">Salary</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                      {filteredEmployees.map((emp) => (
                          <tr key={emp.id} className="hover:bg-slate-800/40">
                            <td className="p-3.5 flex items-center gap-3">
                              <img src={emp.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                              <div>
                                <span onClick={() => setSelectedEmployee(emp)} className="font-bold text-white hover:text-indigo-400 cursor-pointer block">{emp.name}</span>
                                <span className="text-[10px] text-slate-400">{emp.role}</span>
                              </div>
                            </td>
                            <td className="p-3.5 font-mono text-indigo-400 font-bold">{emp.emp_code}</td>
                            <td className="p-3.5 text-slate-400">{emp.email}</td>
                            <td className="p-3.5 font-mono font-bold text-white">${Number(emp.salary).toLocaleString()}</td>
                            <td className="p-3.5 text-right space-x-2">
                              <button onClick={() => { setEditingEmployee(emp); setShowAddModal(true); }} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg">Edit</button>
                              <button onClick={() => setSelectedEmployee(emp)} className="px-2.5 py-1 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 rounded-lg font-bold">Dossier</button>
                              <button onClick={() => { setActiveTab('chat'); setSelectedChatEmp(emp); }} className="px-2.5 py-1 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 rounded-lg font-bold">Chat</button>
                            </td>
                          </tr>
                      ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:hidden">
                    {filteredEmployees.map((emp) => (
                        <div key={emp.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <img src={emp.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                              <div>
                                <h4 className="font-bold text-white text-sm">{emp.name}</h4>
                                <p className="text-slate-400">{emp.role}</p>
                              </div>
                            </div>
                            <span className="font-mono bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-1 rounded-lg font-bold text-xs">{emp.emp_code}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-400 border-t border-slate-800/80 pt-2">
                            <span>Salary: <strong className="text-white">${Number(emp.salary).toLocaleString()}</strong></span>
                            <span>{emp.department}</span>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => { setEditingEmployee(emp); setShowAddModal(true); }} className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold">Edit</button>
                            <button onClick={() => setSelectedEmployee(emp)} className="flex-1 py-1.5 bg-indigo-600/20 text-indigo-300 rounded-xl font-bold">Dossier</button>
                            <button onClick={() => { setActiveTab('chat'); setSelectedChatEmp(emp); }} className="flex-1 py-1.5 bg-emerald-600/20 text-emerald-300 rounded-xl font-bold">Chat</button>
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
            )}

            {/* TAB 4: LEAVES */}
            {activeTab === 'leaves' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 text-xs space-y-4 overflow-x-auto">
                  <h3 className="font-bold text-sm text-white">Vacation & Medical Leave Requests</h3>
                  <table className="w-full text-left border-collapse text-slate-300 min-w-[650px]">
                    <thead>
                    <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-bold text-slate-400 uppercase">
                      <th className="p-3.5">Staff</th>
                      <th className="p-3.5">Type</th>
                      <th className="p-3.5">Dates</th>
                      <th className="p-3.5">Reason</th>
                      <th className="p-3.5">HR Stated Reason</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                    {leaveRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-800/40">
                          <td className="p-3.5 font-bold text-white">{req.employee_name}</td>
                          <td className="p-3.5 text-indigo-400 font-semibold">{req.type}</td>
                          <td className="p-3.5">{req.start_date} → {req.end_date} ({req.days}d)</td>
                          <td className="p-3.5 italic text-slate-400 max-w-xs truncate">{req.reason}</td>
                          <td className="p-3.5 text-slate-300">{req.hr_notes || '--'}</td>
                          <td className="p-3.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800">{req.status}</span></td>
                          <td className="p-3.5 text-right space-x-2">
                            {req.status === 'Pending' && (
                                <>
                                  <button onClick={() => setLeaveDecisionModal({ req, action: 'Approve' })} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-bold">Approve</button>
                                  <button onClick={() => setLeaveDecisionModal({ req, action: 'Decline' })} className="px-3 py-1 bg-rose-600 hover:bg-rose-500 rounded-lg text-white font-bold">Decline</button>
                                </>
                            )}
                          </td>
                        </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
            )}

            {/* TAB 5: FINANCIAL & SALARY REQUESTS */}
            {activeTab === 'requests' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 text-xs space-y-4 overflow-x-auto">
                  <h3 className="font-bold text-sm text-white">Employee Inquiries: Salary Increases & Advance Loans</h3>
                  <table className="w-full text-left border-collapse text-slate-300 min-w-[650px]">
                    <thead>
                    <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-bold text-slate-400 uppercase">
                      <th className="p-3.5">Staff</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Amount</th>
                      <th className="p-3.5">Justification</th>
                      <th className="p-3.5">HR Stated Reason</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                    {generalRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-800/40">
                          <td className="p-3.5 font-bold text-white">{req.employee_name}</td>
                          <td className="p-3.5 text-indigo-400 font-semibold">{req.category}</td>
                          <td className="p-3.5 font-mono font-bold text-emerald-400">{req.amount > 0 ? `$${Number(req.amount).toLocaleString()}` : '--'}</td>
                          <td className="p-3.5 max-w-xs truncate italic text-slate-400">{req.details}</td>
                          <td className="p-3.5 text-slate-300">{req.hr_feedback || '--'}</td>
                          <td className="p-3.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800">{req.status}</span></td>
                          <td className="p-3.5 text-right space-x-2">
                            {req.status === 'Pending' && (
                                <>
                                  <button onClick={() => setRequestDecisionModal({ req, action: 'Approve' })} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-bold">Approve</button>
                                  <button onClick={() => setRequestDecisionModal({ req, action: 'Decline' })} className="px-3 py-1 bg-rose-600 hover:bg-rose-500 rounded-lg text-white font-bold">Decline</button>
                                </>
                            )}
                          </td>
                        </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
            )}

            {/* TAB 6: PAYROLL */}
            {activeTab === 'payroll' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 text-xs overflow-x-auto">
                  <h3 className="font-bold text-sm text-white mb-1">Monthly Compensation & Deductions Ledger</h3>
                  <p className="text-slate-400 mb-5">Formula: Daily Rate = Base Salary / 30. Unpaid days automatically reduce payout.</p>

                  <table className="w-full text-left border-collapse text-slate-300 min-w-[700px]">
                    <thead>
                    <tr className="border-b border-slate-800 bg-slate-950 text-[11px] font-bold text-slate-400 uppercase">
                      <th className="p-3.5">Staff Member</th>
                      <th className="p-3.5">Base Monthly</th>
                      <th className="p-3.5">Daily Rate</th>
                      <th className="p-3.5">Unpaid Days</th>
                      <th className="p-3.5">Leave Deductions</th>
                      <th className="p-3.5">Net Payout</th>
                      <th className="p-3.5 text-right">Payslip</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                    {employees.map((emp) => {
                      const base = parseFloat(emp.salary) || 0;
                      const dailyRate = base / 30;
                      const unpaidDays = emp.leave_unpaid_taken || 0;
                      const deduction = dailyRate * unpaidDays;
                      const netPay = Math.max(0, base - deduction);

                      return (
                          <tr key={emp.id} className="hover:bg-slate-800/40">
                            <td className="p-3.5 font-bold text-white">{emp.name}</td>
                            <td className="p-3.5 font-mono font-semibold">${base.toLocaleString()}</td>
                            <td className="p-3.5 font-mono text-slate-400">${dailyRate.toFixed(2)}/day</td>
                            <td className="p-3.5 font-bold text-rose-400">{unpaidDays} d</td>
                            <td className="p-3.5 font-mono text-rose-400 font-bold">-${deduction.toFixed(2)}</td>
                            <td className="p-3.5 font-mono font-bold text-emerald-400 text-sm">${netPay.toFixed(2)}</td>
                            <td className="p-3.5 text-right">
                              <button onClick={() => setShowPayslipModal(emp)} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium">
                                View Payslip
                              </button>
                            </td>
                          </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
            )}

            {/* TAB 7: DASHBOARD */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
                    <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="text-[10px] sm:text-xs text-slate-400 uppercase font-semibold">Total Personnel</p>
                        <h3 className="text-xl sm:text-2xl font-black text-white mt-1">{employees.length}</h3>
                      </div>
                      <div className="p-2.5 bg-slate-800 rounded-xl"><Users className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" /></div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="text-[10px] sm:text-xs text-slate-400 uppercase font-semibold">Present on Shift</p>
                        <h3 className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">{clockedInToday}</h3>
                      </div>
                      <div className="p-2.5 bg-slate-800 rounded-xl"><Clock className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" /></div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="text-[10px] sm:text-xs text-slate-400 uppercase font-semibold">Pending Leaves</p>
                        <h3 className="text-xl sm:text-2xl font-black text-amber-400 mt-1">{pendingLeaves}</h3>
                      </div>
                      <div className="p-2.5 bg-slate-800 rounded-xl"><CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" /></div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="text-[10px] sm:text-xs text-slate-400 uppercase font-semibold">Monthly Gross</p>
                        <h3 className="text-xl sm:text-2xl font-black text-sky-400 mt-1">${(totalPayroll / 1000).toFixed(1)}k</h3>
                      </div>
                      <div className="p-2.5 bg-slate-800 rounded-xl"><DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-sky-400" /></div>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6">
                    <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-400" /> Legal & Visa Expiry Watchlist
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {employees.filter((e) => e.visa_expiry).slice(0, 3).map((emp) => (
                          <div key={emp.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
                            <div className="flex justify-between font-bold text-white">
                              <span>{emp.name}</span>
                              <span className="text-indigo-400">{emp.visa_status}</span>
                            </div>
                            <p className="text-slate-400">Passport: {emp.passport_number || 'N/A'}</p>
                            <p className="text-amber-400 font-semibold">Visa Expires: {emp.visa_expiry}</p>
                          </div>
                      ))}
                    </div>
                  </div>
                </div>
            )}
          </main>
        </div>

        {/* MODAL: ADD / EDIT EMPLOYEE WITH PHOTO FILE UPLOAD */}
        {showAddModal && (
            <AddEditEmployeeModal
                employee={editingEmployee}
                onClose={() => { setShowAddModal(false); setEditingEmployee(null); }}
                onSave={handleSaveEmployee}
            />
        )}

        {/* MODAL: PRINTABLE PAYSLIP */}
        {showPayslipModal && (
            <PayslipModal
                employee={showPayslipModal}
                onClose={() => setShowPayslipModal(null)}
            />
        )}

        {/* DRAWER: COMPLETE EMPLOYEE DOSSIER */}
        {selectedEmployee && (
            <EmployeeDossierDrawer
                employee={selectedEmployee}
                onClose={() => setSelectedEmployee(null)}
                onPayslip={() => { setShowPayslipModal(selectedEmployee); setSelectedEmployee(null); }}
            />
        )}

        {/* MODAL: LEAVE DECISION */}
        {leaveDecisionModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
                <h3 className="font-bold text-white">State HR Reason for {leaveDecisionModal.action}</h3>
                <form onSubmit={handleLeaveDecision} className="space-y-3">
              <textarea
                  required
                  rows="3"
                  placeholder="State reason visible to employee..."
                  value={leaveDecisionNote}
                  onChange={(e) => setLeaveDecisionNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white"
              />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setLeaveDecisionModal(null)} className="px-4 py-2 text-slate-400">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl">Save</button>
                  </div>
                </form>
              </div>
            </div>
        )}

        {/* MODAL: GENERAL REQUEST DECISION */}
        {requestDecisionModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
                <h3 className="font-bold text-white">State HR Reason for {requestDecisionModal.action}</h3>
                <form onSubmit={handleRequestDecision} className="space-y-3">
              <textarea
                  required
                  rows="3"
                  placeholder="State formal feedback..."
                  value={requestDecisionNote}
                  onChange={(e) => setRequestDecisionNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white"
              />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setRequestDecisionModal(null)} className="px-4 py-2 text-slate-400">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl">Save</button>
                  </div>
                </form>
              </div>
            </div>
        )}

        {/* Toast Alert */}
        {toast && (
            <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl text-xs font-semibold shadow-2xl bg-slate-900 text-white border border-slate-700 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{toast.msg}</span>
            </div>
        )}
      </div>
  );
}

function AddEditEmployeeModal({ employee, onClose, onSave }) {
  const [form, setForm] = useState(
      employee || {
        emp_code: '',
        name: '',
        email: '',
        role: 'Software Engineer',
        department: 'Engineering',
        location: 'Istanbul, Turkey',
        phone: '',
        national_id: '',
        passport_number: '',
        passport_expiry: '',
        visa_status: 'Work Visa Tier-1',
        visa_expiry: '',
        contract_type: 'Full-Time Permanent',
        work_schedule: '09:00 - 18:00',
        weekends: 'Saturday, Sunday',
        salary: 50000,
        birth_date: '2005-04-26',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        leave_annual: 21,
        leave_sick: 14
      }
  );

  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileRef = useRef(null);

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

      setForm((prev) => ({ ...prev, avatar: publicUrlData.publicUrl }));
    } catch (err) {
      alert(err.message);
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-5 sm:p-7 space-y-5 my-8 shadow-2xl text-xs max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center text-white border-b border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-sm">{employee ? 'Edit Employee Dossier' : 'New Personnel Onboarding'}</h3>
              <p className="text-xs text-slate-400">Upload portrait, define access code, and specify contract terms</p>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
            {/* Avatar Upload Container */}
            <div className="flex items-center gap-4 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <img src={form.avatar} alt="Avatar" className="h-14 w-14 rounded-2xl object-cover ring-2 ring-indigo-500 shrink-0" />
              <div>
                <input
                    type="file"
                    accept="image/*"
                    ref={avatarFileRef}
                    onChange={handleAvatarFile}
                    className="hidden"
                />
                <button
                    type="button"
                    disabled={avatarUploading}
                    onClick={() => avatarFileRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{avatarUploading ? 'Uploading...' : 'Choose Photo from Device'}</span>
                </button>
                <p className="text-[10px] text-slate-500 mt-1">Accepts JPG, PNG, or WEBP photos</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Access Code (Employee Login Code) *</label>
                <input required type="text" placeholder="e.g. EMP-101" value={form.emp_code} onChange={(e) => setForm({ ...form, emp_code: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-indigo-400 font-mono font-bold uppercase" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Full Legal Name *</label>
                <input required type="text" placeholder="e.g. Omar Haidari" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Email *</label>
                <input required type="email" placeholder="staff@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Date of Birth *</label>
                <input required type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Phone Number</label>
                <input type="text" placeholder="+90 5..." value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <span className="font-bold text-[11px] text-indigo-400 block mb-2 uppercase tracking-wider">Legal Compliance & Travel</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">National ID / Resident ID</label>
                  <input type="text" placeholder="9928..." value={form.national_id || ''} onChange={(e) => setForm({ ...form, national_id: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Passport Number</label>
                  <input type="text" placeholder="N9832..." value={form.passport_number || ''} onChange={(e) => setForm({ ...form, passport_number: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Passport Expiry</label>
                  <input type="date" value={form.passport_expiry || ''} onChange={(e) => setForm({ ...form, passport_expiry: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-slate-400 block mb-1">Visa / Residency Permit Status</label>
                  <input type="text" placeholder="Work Permit / Citizen" value={form.visa_status || ''} onChange={(e) => setForm({ ...form, visa_status: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Visa Expiry Date</label>
                  <input type="date" value={form.visa_expiry || ''} onChange={(e) => setForm({ ...form, visa_expiry: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <span className="font-bold text-[11px] text-indigo-400 block mb-2 uppercase tracking-wider">Employment Terms</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Role *</label>
                  <input required type="text" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Department</label>
                  <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white">
                    {DEPARTMENTS.filter((d) => d !== 'All Departments').map((d) => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Base Monthly Salary ($) *</label>
                  <input required type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-3">
              <div>
                <label className="text-slate-400 block mb-1">Annual Paid Vacation (Days)</label>
                <input type="number" value={form.leave_annual} onChange={(e) => setForm({ ...form, leave_annual: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Medical / Sick Quota (Days)</label>
                <input type="number" value={form.leave_sick} onChange={(e) => setForm({ ...form, leave_sick: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-slate-400 hover:text-white">Cancel</button>
              <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition">
                Save Employee Dossier
              </button>
            </div>
          </form>
        </div>
      </div>
  );
}

function EmployeeDossierDrawer({ employee, onClose, onPayslip }) {
  return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
        <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase">{employee.emp_code}</span>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex items-center gap-4">
              <img src={employee.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} alt="" className="h-16 w-16 rounded-2xl object-cover ring-2 ring-indigo-500 shadow-md" />
              <div>
                <h2 className="text-base font-bold text-white">{employee.name}</h2>
                <p className="text-slate-400">{employee.role}</p>
                <p className="text-indigo-400 font-semibold">{employee.department}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl space-y-2 border border-slate-800/80">
              <div className="font-bold uppercase text-[10px] tracking-wider text-slate-400">Access & Birthday</div>
              <div className="flex justify-between"><span>Login Access Code:</span> <span className="text-emerald-400 font-mono font-bold">{employee.emp_code}</span></div>
              <div className="flex justify-between"><span>Date of Birth:</span> <span className="text-white">{employee.birth_date || 'N/A'}</span></div>
              <div className="flex justify-between"><span>Email:</span> <span className="text-white">{employee.email || 'N/A'}</span></div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl space-y-2 border border-slate-800/80">
              <div className="font-bold uppercase text-[10px] tracking-wider text-slate-400">Legal Identity</div>
              <div className="flex justify-between"><span>Passport:</span> <span className="text-white font-mono">{employee.passport_number || 'N/A'}</span></div>
              <div className="flex justify-between"><span>Visa Status:</span> <span className="text-indigo-400 font-semibold">{employee.visa_status}</span></div>
              <div className="flex justify-between"><span>Visa Expiry:</span> <span className="text-amber-400 font-semibold">{employee.visa_expiry || 'Permanent'}</span></div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl space-y-2 border border-slate-800/80">
              <div className="font-bold uppercase text-[10px] tracking-wider text-slate-400">Remaining Quotas</div>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="block text-[10px] text-slate-500">Annual</span>
                  <span className="font-bold text-emerald-400">{employee.leave_annual}d</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="block text-[10px] text-slate-500">Sick</span>
                  <span className="font-bold text-indigo-400">{employee.leave_sick}d</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="block text-[10px] text-slate-500">Unpaid</span>
                  <span className="font-bold text-rose-400">{employee.leave_unpaid_taken || 0}d</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button onClick={onPayslip} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md">
              Generate Official Pay Statement
            </button>
          </div>
        </div>
      </div>
  );
}

function PayslipModal({ employee, onClose }) {
  const base = parseFloat(employee.salary) || 0;
  const dailyRate = base / 30;
  const unpaidDays = employee.leave_unpaid_taken || 0;
  const deduction = dailyRate * unpaidDays;
  const taxes = base * 0.15;
  const net = Math.max(0, base - deduction - taxes);

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-white text-slate-900 rounded-3xl w-full max-w-lg p-5 sm:p-7 space-y-5 text-xs shadow-2xl">
          <div className="flex justify-between items-start border-b pb-4">
            <div>
              <h2 className="text-base font-black uppercase tracking-tight">Executive HR Global Ltd.</h2>
              <p className="text-slate-500">Monthly Compensation Statement</p>
            </div>
            <button onClick={() => window.print()} className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl font-bold">
              Print / PDF
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-2xl">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Staff Member</span>
              <p className="font-bold text-slate-900">{employee.name}</p>
              <p className="text-slate-600">{employee.role} • {employee.emp_code}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Accounting Cycle</span>
              <p className="font-bold">Monthly Run</p>
              <p className="text-slate-500">Visa: {employee.visa_status}</p>
            </div>
          </div>

          <div className="space-y-2 border-b pb-4">
            <div className="flex justify-between">
              <span>Base Contract Salary</span>
              <span className="font-bold">${base.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-rose-600">
              <span>Unpaid Absences ({unpaidDays} days @ ${dailyRate.toFixed(2)}/day)</span>
              <span className="font-bold">-${deduction.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Estimated Standard Withholding (15%)</span>
              <span>-${taxes.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center text-sm font-black text-indigo-700 bg-indigo-50 p-4 rounded-2xl">
            <span>Net Disbursed Amount</span>
            <span>${net.toFixed(2)}</span>
          </div>

          <button onClick={onClose} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition">
            Dismiss
          </button>
        </div>
      </div>
  );
}