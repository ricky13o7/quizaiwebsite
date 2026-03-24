import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users, Plus, LogIn, Loader2, Copy, School, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Classroom {
  id: string;
  name: string;
  description: string | null;
  join_code: string;
  teacher_id: string;
  created_at: string;
  member_count?: number;
}

const Classrooms = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myClassrooms, setMyClassrooms] = useState<Classroom[]>([]);
  const [joinedClassrooms, setJoinedClassrooms] = useState<Classroom[]>([]);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Join dialog
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const loadClassrooms = async () => {
    if (!user) return;
    try {
      // Classrooms I created
      const { data: owned } = await supabase
        .from("classrooms")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      // Classrooms I'm a member of
      const { data: memberships } = await supabase
        .from("classroom_members")
        .select("classroom_id")
        .eq("user_id", user.id);

      const memberClassroomIds = (memberships || []).map((m: any) => m.classroom_id);
      let joined: Classroom[] = [];
      if (memberClassroomIds.length > 0) {
        const { data } = await supabase
          .from("classrooms")
          .select("*")
          .in("id", memberClassroomIds)
          .neq("teacher_id", user.id);
        joined = (data || []) as Classroom[];
      }

      setMyClassrooms((owned || []) as Classroom[]);
      setJoinedClassrooms(joined);
    } catch (err) {
      console.error("Failed to load classrooms:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClassrooms(); }, [user]);

  const handleCreate = async () => {
    if (!newName.trim() || !user) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("classrooms").insert({
        name: newName.trim(),
        description: newDesc.trim() || null,
        teacher_id: user.id,
      } as any);
      if (error) throw error;
      toast.success("Classroom created!");
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
      loadClassrooms();
    } catch (err: any) {
      toast.error(err.message || "Failed to create classroom");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || !user) return;
    setJoining(true);
    try {
      const { data: classroom } = await supabase
        .from("classrooms")
        .select("id, teacher_id")
        .eq("join_code", joinCode.trim().toLowerCase())
        .single();

      if (!classroom) { toast.error("Invalid class code"); setJoining(false); return; }
      if (classroom.teacher_id === user.id) { toast.error("You own this classroom"); setJoining(false); return; }

      const { error } = await supabase.from("classroom_members").insert({
        classroom_id: classroom.id,
        user_id: user.id,
        role: "student",
      } as any);

      if (error) {
        if (error.code === "23505") toast.info("You've already joined this classroom");
        else throw error;
      } else {
        toast.success("Joined classroom!");
      }
      setJoinOpen(false);
      setJoinCode("");
      loadClassrooms();
    } catch (err: any) {
      toast.error(err.message || "Failed to join classroom");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-32 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const ClassroomCard = ({ c, isTeacher }: { c: Classroom; isTeacher: boolean }) => (
    <Link to={`/classrooms/${c.id}`}>
      <div className="card-elevated p-5 group hover:border-primary/30 transition-all">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate group-hover:text-primary transition-colors">{c.name}</h3>
            {c.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
            <div className="flex items-center gap-3 mt-3">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                isTeacher ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {isTeacher ? "Teacher" : "Student"}
              </span>
              {isTeacher && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    navigator.clipboard.writeText(c.join_code);
                    toast.success("Class code copied!");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" />
                  {c.join_code}
                </button>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>
      </div>
    </Link>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <School className="h-6 w-6 text-primary" />
                <h1 className="text-3xl font-bold font-display">Classrooms</h1>
              </div>
              <p className="text-muted-foreground">Create or join classrooms to share tests and track progress.</p>
            </div>
            <div className="flex gap-2">
              <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <LogIn className="mr-2 h-4 w-4" />
                    Join Class
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Join a Classroom</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <Label className="text-sm">Class Code</Label>
                      <Input
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        placeholder="Enter the class code from your teacher"
                        onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                      />
                    </div>
                    <Button onClick={handleJoin} disabled={joining || !joinCode.trim()} className="w-full gradient-bg text-primary-foreground">
                      {joining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                      Join Classroom
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-bg text-primary-foreground" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Class
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a Classroom</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <Label className="text-sm">Class Name</Label>
                      <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Physics 101" />
                    </div>
                    <div>
                      <Label className="text-sm">Description (optional)</Label>
                      <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="e.g. 10th Grade Physics" />
                    </div>
                    <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="w-full gradient-bg text-primary-foreground">
                      {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Create Classroom
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </motion.div>

          {myClassrooms.length === 0 && joinedClassrooms.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2 font-display">No classrooms yet</h2>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Create a classroom to share tests with students, or join one using a class code.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-8">
              {myClassrooms.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    My Classrooms
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {myClassrooms.map((c) => <ClassroomCard key={c.id} c={c} isTeacher />)}
                  </div>
                </div>
              )}
              {joinedClassrooms.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <LogIn className="h-4 w-4 text-primary" />
                    Joined Classrooms
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {joinedClassrooms.map((c) => <ClassroomCard key={c.id} c={c} isTeacher={false} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Classrooms;
