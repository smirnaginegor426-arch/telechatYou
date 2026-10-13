import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router";
import { MessageCircle, Users, UserRound, Settings2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
const tabs = [
  { to: "/", label: "Чаты", icon: MessageCircle },
  { to: "/contacts", label: "Люди", icon: Users },
  { to: "/profile", label: "Профиль", icon: UserRound },
  { to: "/settings", label: "Настройки", icon: Settings2 },
];
type Gesture = { pointerId: number; startX: number; startY: number; originTo: string; targetTo: string | null; dragging: boolean; };
export function TabBar({ unreadTotal = 0 }: { unreadTotal?: number }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const hidden = /^\/chat\/\d+(?:\/info)?\/?$/.test(location.pathname) || location.pathname.startsWith("/setup");
  const clearLongPress = () => {
    if (longPressTimer.current !== null) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };
  useEffect(() => {
    const getTabAtPoint = (x: number, y: number) => {
      const to = document.elementFromPoint(x,y)?.closest<HTMLElement>("[data-tab-to]")?.dataset.tabTo;
      return to && tabs.some((tab) => tab.to === to) ? to : null;
    };
    const onMove = (event: PointerEvent) => {
      const gesture=gestureRef.current;
      if(!gesture || gesture.pointerId!==event.pointerId) return;
      if(!gesture.dragging) {
        if(Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY)>12 && longPressTimer.current!==null) {
          window.clearTimeout(longPressTimer.current); longPressTimer.current=null;
        }
        return;
      }
      event.preventDefault();
      const next=getTabAtPoint(event.clientX,event.clientY);
      if(next!==gesture.targetTo){gesture.targetTo=next;setDragTarget(next);}
    };
    const onUp=(event: PointerEvent) => {
      const gesture=gestureRef.current;
      if(!gesture || gesture.pointerId!==event.pointerId) return;
      clearLongPress();gestureRef.current=null;setDragTarget(null);
      if(gesture.dragging){
        event.preventDefault();suppressClickRef.current=true;
        window.setTimeout(()=>{suppressClickRef.current=false;},0);
        const target=getTabAtPoint(event.clientX,event.clientY);
        if(target)navigate(target);
      }
    };
    const onCancel=(event:PointerEvent)=>{
      if(gestureRef.current?.pointerId!==event.pointerId)return;
      clearLongPress();gestureRef.current=null;setDragTarget(null);
    };
    window.addEventListener("pointermove",onMove,{passive:false});
    window.addEventListener("pointerup",onUp);
    window.addEventListener("pointercancel",onCancel);
    return ()=>{window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp);window.removeEventListener("pointercancel",onCancel);clearLongPress();};
  },[navigate]);
  const onPointerDown=(event:ReactPointerEvent<HTMLButtonElement>,to:string)=>{
    if(!event.isPrimary||event.button!==0)return;
    clearLongPress();
    gestureRef.current={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,originTo:to,targetTo:to,dragging:false};
    longPressTimer.current=window.setTimeout(()=>{
      const gesture=gestureRef.current;
      if(!gesture||gesture.pointerId!==event.pointerId)return;
      gesture.dragging=true;setDragTarget(gesture.targetTo);
      if("vibrate" in navigator)navigator.vibrate?.(12);
    },260);
  };
  if(hidden)return null;
  return (
    <nav aria-label="Основная навигация" className="absolute bottom-0 left-0 right-0 z-30 safe-bottom tcy-no-select">
      <div className="tcy-island mx-4 mb-3 rounded-[28px] border tcy-line tcy-header-blur">
        <div className="grid grid-cols-4 min-h-[70px] px-1.5 py-1.5">
          {tabs.map(({to,label,icon:Icon})=>{
            const active=to==="/" ? location.pathname==="/" : location.pathname.startsWith(to);
            const highlighted=dragTarget ? dragTarget===to : active;
            return <button key={to} type="button" data-tab-to={to} aria-label={label} aria-current={active?"page":undefined}
              onPointerDown={(event)=>onPointerDown(event,to)}
              onClick={()=>{if(suppressClickRef.current){suppressClickRef.current=false;return;}navigate(to);}}
              className={cn("relative min-w-0 flex flex-col items-center justify-center gap-0.5 rounded-[21px] py-1.5 outline-none touch-none transition-colors duration-200",highlighted&&"tcy-tab-highlight",dragTarget===to&&"scale-[1.04]")}
              style={{color:highlighted?"var(--tcy-accent)":"var(--tcy-faint)"}}>
              {highlighted&&<motion.span layoutId="tcy-tab-orb" className="absolute top-1 w-10 h-9 rounded-[15px] tcy-tab-orb pointer-events-none" transition={{type:"spring",stiffness:720,damping:42}}/>}
              <span className="relative z-[1] flex h-8 items-center justify-center pointer-events-none">
                <motion.span animate={{scale:highlighted?1.04:1,y:highlighted?-1:0}} transition={{type:"spring",stiffness:620,damping:34}}>
                  <Icon size={26} strokeWidth={highlighted?2.45:1.8}/>
                </motion.span>
                {to==="/"&&unreadTotal>0&&<motion.span initial={{scale:0}} animate={{scale:1}} className="absolute -top-1 -right-3 min-w-[17px] h-[17px] px-1 rounded-full tcy-gradient-accent text-[10px] font-bold flex items-center justify-center" style={{color:"var(--tcy-on-accent)"}}>{unreadTotal>99?"99+":unreadTotal}</motion.span>}
                {highlighted&&<motion.span className="absolute -right-2 -top-0.5 tcy-tab-spark" initial={{opacity:0,scale:0.4,rotate:-35}} animate={{opacity:1,scale:1,rotate:0}} transition={{type:"spring",stiffness:420,damping:22}}><Sparkles size={10}/></motion.span>}
              </span>
              <AnimatePresence initial={false}>{active&&<motion.span key={to+"-label"} initial={{opacity:0,y:5,height:0}} animate={{opacity:1,y:0,height:14}} exit={{opacity:0,y:4,height:0}} transition={{duration:0.22,ease:"easeOut"}} className="relative z-[1] overflow-hidden whitespace-nowrap text-[10.5px] font-bold leading-[14px] pointer-events-none">{label}</motion.span>}</AnimatePresence>
            </button>;
          })}
        </div>
      </div>
    </nav>
  );
}
