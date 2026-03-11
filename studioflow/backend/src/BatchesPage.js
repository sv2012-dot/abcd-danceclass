import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { batches as api, students as studentsApi } from "../api";
import toast from "react-hot-toast";
import Card from "../components/shared/Card";
import Button from "../components/shared/Button";
import Badge from "../components/shared/Badge";
import Modal from "../components/shared/Modal";
import { Field, Input, Select, Textarea } from "../components/shared/Field";

const LEVELS = ["Beginner", "Intermediate", "Advanced", "Mixed"];
const BATCH_COLORS = ["#e8607a","#6a7fdb","#f4a041","#52c4a0","#b47fe8","#e87a52"];
const EMPTY = { name:"", dance_style:"", level:"Beginner", teacher_name:"", max_size:"", notes:"" };

export default function BatchesPage() {
  const { user } = useAuth();
  const sid = user?.school_id;
  const qc = useQueryClient();

  const [modal, setModal]         = useState(null); // null | {} | batch obj
  const [form, setForm]           = useState(EMPTY);
  const [enrollModal, setEnrollModal] = useState(null); // batch obj
  const [selected, setSelected]   = useState([]); // student ids for enroll

  const { data: list=[], isLoading } = useQuery({
    queryKey: ["batches", sid],
    queryFn: () => api.list(sid),
    enabled: !!sid,
  });

  const { data: allStudents=[] } = useQuery({
    queryKey: ["students", sid],
    queryFn: () => studentsApi.list(sid),
    enabled: !!sid,
  });

  // ── Save batch ────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: data => modal?.id ? api.update(sid, modal.id, data) : api.create(sid, data),
    onSuccess: () => {
      qc.invalidateQueries(["batches", sid]);
      qc.invalidateQueries(["stats", sid]);
      toast.success(modal?.id ? "Batch updated" : "Batch created");
      setModal(null);
    },
    onError: err => toast.error(err.error || "Failed"),
  });

  // ── Delete batch ──────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: id => api.remove(sid, id),
    onSuccess: () => {
      qc.invalidateQueries(["batches", sid]);
      qc.invalidateQueries(["stats", sid]);
      toast.success("Batch deleted");
    },
    onError: err => toast.error(err.error || "Failed"),
  });

  // ── Enroll students ───────────────────────────────────────────────────────
  const enrollMutation = useMutation({
    mutationFn: () => api.enroll(sid, enrollModal.id, selected),
    onSuccess: () => {
      qc.invalidateQueries(["batches", sid]);
      qc.invalidateQueries(["students", sid]);
      toast.success("Enrolment saved");
      setEnrollModal(null);
    },
    onError: err => toast.error(err.error || "Failed"),
  });

  const openAdd = () => { setForm(EMPTY); setModal({}); };
  const openEdit = b => {
    setForm({ name:b.name||"", dance_style:b.dance_style||"", level:b.level||"Beginner", teacher_name:b.teacher_name||"", max_size:b.max_size||"", notes:b.notes||"" });
    setModal(b);
  };

  const openEnroll = async b => {
    // fetch full batch with current students
    const full = await api.get(sid, b.id);
    setSelected((full.students || []).map(s => s.id));
    setEnrollModal(b);
  };

  const toggleStudent = id => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div>
      {/* ── Header ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div>
          <h1 style={{fontFamily:"var(--font-d)",fontSize:24,marginBottom:2}}>Batches</h1>
          <p style={{color:"var(--muted)",fontSize:12}}>{list.length} active groups</p>
        </div>
        <Button onClick={openAdd} icon="➕">New Batch</Button>
      </div>

      {/* ── List ── */}
      {isLoading ? (
        <p style={{color:"var(--muted)"}}>Loading…</p>
      ) : list.length === 0 ? (
        <Card style={{textAlign:"center",padding:48,border:"1.5px dashed var(--border)"}}>
          <div style={{fontSize:36,marginBottom:10}}>📚</div>
          <p style={{color:"var(--muted)",marginBottom:12}}>No batches yet. Create your first group!</p>
          <Button onClick={openAdd} icon="➕">New Batch</Button>
        </Card>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
          {list.map((b, i) => {
            const color = BATCH_COLORS[i % BATCH_COLORS.length];
            const pct = b.max_size ? Math.min(100, Math.round((b.student_count / b.max_size) * 100)) : null;
            return (
              <Card key={b.id} style={{padding:0,overflow:"hidden"}}>
                {/* colour bar */}
                <div style={{height:5,background:color}} />
                <div style={{padding:16}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
                    <div>
                      <div style={{fontWeight:800,fontSize:15,marginBottom:3}}>{b.name}</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        <Badge color={color}>{b.level}</Badge>
                        {b.dance_style && <Badge color="#8a7a9a">{b.dance_style}</Badge>}
                      </div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontFamily:"var(--font-d)",fontSize:22,fontWeight:800,color,lineHeight:1}}>{b.student_count}</div>
                      <div style={{fontSize:10,color:"var(--muted)"}}>
                        {b.max_size ? `of ${b.max_size} students` : "students"}
                      </div>
                    </div>
                  </div>

                  {b.teacher_name && (
                    <div style={{fontSize:12,color:"var(--muted)",marginBottom:8}}>👩‍🏫 {b.teacher_name}</div>
                  )}

                  {/* capacity bar */}
                  {pct !== null && (
                    <div style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--muted)",marginBottom:4}}>
                        <span>Capacity</span><span>{pct}%</span>
                      </div>
                      <div style={{height:5,background:"var(--border)",borderRadius:10,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${pct}%`,background:pct>=90?"var(--danger)":color,borderRadius:10,transition:"width .3s"}} />
                      </div>
                    </div>
                  )}

                  <div style={{display:"flex",gap:7,marginTop:4}}>
                    <Button size="sm" variant="ghost" onClick={() => openEnroll(b)} style={{flex:1}}>👥 Enrol</Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(b)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => { if(window.confirm(`Delete "${b.name}"?`)) deleteMutation.mutate(b.id); }}>✕</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {modal !== null && (
        <Modal title={modal.id ? "Edit Batch" : "New Batch"} onClose={() => setModal(null)}>
          <Field label="Batch Name *">
            <Input value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="e.g. Junior Ballet" />
          </Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
            <Field label="Dance Style">
              <Input value={form.dance_style} onChange={e => setForm({...form, dance_style:e.target.value})} placeholder="e.g. Ballet" />
            </Field>
            <Field label="Level">
              <Select value={form.level} onChange={e => setForm({...form, level:e.target.value})}>
                {LEVELS.map(l => <option key={l}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Teacher Name">
              <Input value={form.teacher_name} onChange={e => setForm({...form, teacher_name:e.target.value})} placeholder="e.g. Priya Sharma" />
            </Field>
            <Field label="Max Size">
              <Input type="number" value={form.max_size} onChange={e => setForm({...form, max_size:e.target.value})} placeholder="e.g. 12" />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} />
          </Field>
          <div style={{display:"flex",gap:9,marginTop:8}}>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : modal.id ? "Save Changes" : "Create Batch"}
            </Button>
            <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
          </div>
        </Modal>
      )}

      {/* ── Enrol Students Modal ── */}
      {enrollModal && (
        <Modal title={`Enrol Students — ${enrollModal.name}`} onClose={() => setEnrollModal(null)} wide>
          <p style={{color:"var(--muted)",fontSize:13,marginBottom:14}}>
            Select which students belong to this batch. {selected.length} selected.
          </p>

          {allStudents.length === 0 ? (
            <p style={{color:"var(--muted)"}}>No students in the school yet. Add students first.</p>
          ) : (
            <div style={{display:"grid",gap:7,maxHeight:340,overflowY:"auto",marginBottom:16}}>
              {allStudents.map(s => {
                const checked = selected.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => toggleStudent(s.id)}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"10px 13px",borderRadius:10,border:`1.5px solid ${checked?"var(--accent)":"var(--border)"}`,background:checked?"#c4527a11":"#faf8fc",cursor:"pointer",transition:"all .15s"}}
                  >
                    <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${checked?"var(--accent)":"var(--border)"}`,background:checked?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
                      {checked && <span style={{color:"#fff",fontSize:12,fontWeight:800}}>✓</span>}
                    </div>
                    <div style={{width:32,height:32,borderRadius:"50%",background:`hsl(${s.name.charCodeAt(0)*7%360},55%,68%)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:13,flexShrink:0}}>
                      {s.name[0]}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:13}}>{s.name}</div>
                      {s.age && <div style={{fontSize:11,color:"var(--muted)"}}>Age {s.age}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{display:"flex",gap:9,paddingTop:8,borderTop:"1px solid var(--border)"}}>
            <Button onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending}>
              {enrollMutation.isPending ? "Saving…" : `Save Enrolment (${selected.length})`}
            </Button>
            <Button variant="outline" onClick={() => setEnrollModal(null)}>Cancel</Button>
            <Button variant="ghost" onClick={() => setSelected(allStudents.map(s => s.id))} style={{marginLeft:"auto"}}>Select All</Button>
            <Button variant="ghost" onClick={() => setSelected([])}>Clear</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
