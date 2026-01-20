export function AnimatedBackground() {
  return (
    <>
      <div className="bg-3d-container">
        {/* 3D Floating layers */}
        <div className="layer layer-1"></div>
        <div className="layer layer-2"></div>
        <div className="layer layer-3"></div>
        <div className="layer layer-4"></div>
        <div className="layer layer-5"></div>
        
        {/* Golden accent curves */}
        <svg className="golden-curves" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="gold1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(184,151,42,0)" />
              <stop offset="50%" stopColor="rgba(184,151,42,0.5)" />
              <stop offset="100%" stopColor="rgba(184,151,42,0)" />
            </linearGradient>
          </defs>
          <path className="curve curve-1" d="M-100,400 Q400,300 800,400 T1700,350 T2500,400" stroke="url(#gold1)" fill="none" strokeWidth="2"/>
          <path className="curve curve-2" d="M-100,700 Q500,600 1000,700 T1800,650 T2500,700" stroke="url(#gold1)" fill="none" strokeWidth="1.5"/>
        </svg>

        {/* Floating particles */}
        <div className="particles">
          <span></span><span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>

      <style>{`
        .bg-3d-container {
          position: fixed;
          top: 80px; /* Below navbar */
          left: 0;
          width: 100vw;
          height: calc(100vh - 80px);
          z-index: -1;
          overflow: hidden;
          perspective: 1000px;
          perspective-origin: 50% 50%;
          background: linear-gradient(180deg, #0a0a0c 0%, #0c0c0f 50%, #0a0a0c 100%);
        }

        /* 3D Floating layers with depth */
        .layer {
          position: absolute;
          border-radius: 50%;
          transform-style: preserve-3d;
          backface-visibility: hidden;
          will-change: transform;
        }

        .layer-1 {
          width: 600px;
          height: 600px;
          left: -10%;
          top: 0%;
          background: radial-gradient(ellipse at center, rgba(35,32,28,0.6) 0%, rgba(25,23,20,0.3) 40%, transparent 70%);
          animation: float3d-1 25s ease-in-out infinite;
          filter: blur(40px);
        }

        .layer-2 {
          width: 500px;
          height: 500px;
          right: -5%;
          top: 10%;
          background: radial-gradient(ellipse at center, rgba(28,28,35,0.5) 0%, rgba(18,18,22,0.25) 40%, transparent 70%);
          animation: float3d-2 30s ease-in-out infinite;
          filter: blur(50px);
        }

        .layer-3 {
          width: 700px;
          height: 700px;
          left: 20%;
          top: 40%;
          background: radial-gradient(ellipse at center, rgba(30,28,24,0.45) 0%, rgba(20,18,15,0.2) 40%, transparent 70%);
          animation: float3d-3 28s ease-in-out infinite;
          filter: blur(60px);
        }

        .layer-4 {
          width: 400px;
          height: 400px;
          right: 15%;
          bottom: 10%;
          background: radial-gradient(ellipse at center, rgba(32,30,26,0.4) 0%, rgba(22,20,18,0.15) 40%, transparent 70%);
          animation: float3d-4 22s ease-in-out infinite;
          filter: blur(45px);
        }

        .layer-5 {
          width: 550px;
          height: 550px;
          left: 50%;
          top: 5%;
          background: radial-gradient(ellipse at center, rgba(25,25,30,0.35) 0%, rgba(15,15,18,0.15) 40%, transparent 70%);
          animation: float3d-5 26s ease-in-out infinite;
          filter: blur(55px);
        }

        @keyframes float3d-1 {
          0%, 100% { transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) scale(1); }
          25% { transform: translate3d(30px, -20px, 50px) rotateX(5deg) rotateY(-3deg) scale(1.05); }
          50% { transform: translate3d(10px, 20px, 100px) rotateX(-3deg) rotateY(5deg) scale(0.98); }
          75% { transform: translate3d(-20px, 10px, 30px) rotateX(3deg) rotateY(-2deg) scale(1.02); }
        }

        @keyframes float3d-2 {
          0%, 100% { transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) scale(1); }
          33% { transform: translate3d(-25px, 15px, 80px) rotateX(-4deg) rotateY(4deg) scale(0.96); }
          66% { transform: translate3d(15px, -25px, 40px) rotateX(4deg) rotateY(-3deg) scale(1.04); }
        }

        @keyframes float3d-3 {
          0%, 100% { transform: translate3d(0, 0, 50px) rotateX(0deg) rotateY(0deg) scale(1); }
          50% { transform: translate3d(25px, -30px, 120px) rotateX(5deg) rotateY(5deg) scale(1.03); }
        }

        @keyframes float3d-4 {
          0%, 100% { transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) scale(1); }
          25% { transform: translate3d(-20px, 25px, 60px) rotateX(-3deg) rotateY(4deg) scale(1.05); }
          75% { transform: translate3d(30px, -15px, 90px) rotateX(4deg) rotateY(-5deg) scale(0.95); }
        }

        @keyframes float3d-5 {
          0%, 100% { transform: translate3d(0, 0, 30px) rotateX(0deg) rotateY(0deg) scale(1); }
          40% { transform: translate3d(-30px, 20px, 100px) rotateX(3deg) rotateY(-4deg) scale(1.02); }
          70% { transform: translate3d(20px, -20px, 60px) rotateX(-4deg) rotateY(3deg) scale(0.98); }
        }

        /* Golden SVG curves */
        .golden-curves {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0.6;
        }

        .curve {
          stroke-dasharray: 2000;
          stroke-dashoffset: 0;
          filter: drop-shadow(0 0 3px rgba(184,151,42,0.3));
        }

        .curve-1 {
          animation: waveCurve1 12s ease-in-out infinite;
        }

        .curve-2 {
          animation: waveCurve2 15s ease-in-out infinite;
        }

        @keyframes waveCurve1 {
          0%, 100% { 
            d: path("M-100,400 Q400,300 800,400 T1700,350 T2500,400");
            opacity: 0.4;
          }
          50% { 
            d: path("M-100,420 Q400,350 800,380 T1700,400 T2500,380");
            opacity: 0.7;
          }
        }

        @keyframes waveCurve2 {
          0%, 100% { 
            d: path("M-100,700 Q500,600 1000,700 T1800,650 T2500,700");
            opacity: 0.3;
          }
          50% { 
            d: path("M-100,680 Q500,650 1000,680 T1800,700 T2500,680");
            opacity: 0.6;
          }
        }

        /* Floating particles */
        .particles {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .particles span {
          position: absolute;
          width: 4px;
          height: 4px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(255,255,255,0.2), 0 0 20px rgba(184,151,42,0.1);
          animation: particleFloat 20s linear infinite;
        }

        .particles span:nth-child(1) { left: 10%; animation-delay: 0s; animation-duration: 25s; }
        .particles span:nth-child(2) { left: 20%; animation-delay: 2s; animation-duration: 22s; background: rgba(184,151,42,0.4); }
        .particles span:nth-child(3) { left: 30%; animation-delay: 4s; animation-duration: 28s; }
        .particles span:nth-child(4) { left: 40%; animation-delay: 1s; animation-duration: 24s; background: rgba(184,151,42,0.3); }
        .particles span:nth-child(5) { left: 55%; animation-delay: 3s; animation-duration: 26s; }
        .particles span:nth-child(6) { left: 65%; animation-delay: 5s; animation-duration: 23s; background: rgba(184,151,42,0.35); }
        .particles span:nth-child(7) { left: 75%; animation-delay: 2s; animation-duration: 27s; }
        .particles span:nth-child(8) { left: 82%; animation-delay: 4s; animation-duration: 21s; background: rgba(184,151,42,0.4); }
        .particles span:nth-child(9) { left: 88%; animation-delay: 1s; animation-duration: 29s; }
        .particles span:nth-child(10) { left: 95%; animation-delay: 3s; animation-duration: 25s; background: rgba(184,151,42,0.3); }

        @keyframes particleFloat {
          0% {
            transform: translateY(100vh) translateZ(0) scale(0);
            opacity: 0;
          }
          10% {
            opacity: 0.6;
            transform: translateY(90vh) translateZ(20px) scale(1);
          }
          90% {
            opacity: 0.6;
            transform: translateY(10vh) translateZ(50px) scale(1);
          }
          100% {
            transform: translateY(-10vh) translateZ(0) scale(0);
            opacity: 0;
          }
        }

        @media (max-width: 768px) {
          .bg-3d-container {
            top: 64px;
            height: calc(100vh - 64px);
          }
          .layer { filter: blur(30px); }
        }
      `}</style>
    </>
  );
}
