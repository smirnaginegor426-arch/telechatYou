import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useFileUrl } from "@/hooks/useFileUrl";
import { formatFileSize } from "@/lib/format";

export function Lightbox({imageKey,name,subtitle,fallbackName,size,onClose}:{
 imageKey:string|null; name?:string|null; subtitle?:string|null; fallbackName?:string|null; size?:number|null; onClose:()=>void;
}) {
 const url=useFileUrl(imageKey);
 return <AnimatePresence>{(imageKey||fallbackName)&&(
  <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 z-50 flex flex-col"
   style={{background:"rgba(0,0,0,0.9)",backdropFilter:"blur(10px)"}} onClick={onClose}>
   <div className="flex items-start justify-between px-4 py-4 safe-top">
    <div className="min-w-0"><div className="text-[14.5px] font-bold text-white truncate">{name??fallbackName??"Фото"}</div>
     {subtitle&&<div className="mt-0.5 text-[12px] font-semibold text-white/70 truncate">{subtitle}</div>}
     {size?<div className="text-[12px] text-white/60">{formatFileSize(size)}</div>:null}</div>
    <button type="button" aria-label="Закрыть фотографию" onClick={(event)=>{event.stopPropagation();onClose();}}
     className="tcy-press w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"><X size={20}/></button>
   </div>
   <div className="flex-1 flex items-center justify-center p-4 min-h-0">
    {imageKey ? (url?<motion.img initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:"spring",stiffness:300,damping:28}}
      src={url} alt={name??"Фото"} className="max-w-full max-h-full object-contain rounded-[18px]" onClick={(event)=>event.stopPropagation()}/>
      :<div className="tcy-skeleton w-[260px] h-[200px] rounded-[18px]"/>) :
      fallbackName?<div onClick={(event)=>event.stopPropagation()}><Avatar name={fallbackName} size={240}/></div>:null}
   </div>
  </motion.div>
 )}</AnimatePresence>;
}
