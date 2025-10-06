import { useEffect, useRef, useCallback, useState } from 'react'

const AnimatedBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(true)
  const animationFrameRef = useRef<number>()
  const intervalsRef = useRef<NodeJS.Timeout[]>([])

  // Cleanup function to remove all intervals and animation frames
  const cleanup = useCallback(() => {
    intervalsRef.current.forEach(interval => clearInterval(interval))
    intervalsRef.current = []
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  // Visibility observer to pause animations when not visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.1 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !isVisible) return

    // Balanced number of elements for good visual impact
    const createResilienceNodes = () => {
      for (let i = 0; i < 8; i++) { // Increased from 6 to 8
        const node = document.createElement('div')
        node.className = 'resilience-node'
        node.style.cssText = `
          position: absolute;
          width: 10px;
          height: 10px;
          background: radial-gradient(circle, #3b82f6, #1e40af);
          border: 1px solid rgba(34, 197, 94, 0.4);
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.6);
          animation: resilienceFloat 8s ease-in-out infinite;
          left: ${Math.random() * 100}%;
          top: ${Math.random() * 100}%;
          animation-delay: ${Math.random() * 8}s;
        `
        container.appendChild(node)
      }
    }

    const createHumanIcons = () => {
      for (let i = 0; i < 5; i++) { 
        const icon = document.createElement('div')
        icon.className = 'human-icon'
        icon.style.cssText = `
          position: absolute;
          width: 16px;
          height: 16px;
          animation: humanGlow 4s ease-in-out infinite;
          left: ${Math.random() * 100}%;
          top: ${Math.random() * 100}%;
          animation-delay: ${Math.random() * 4}s;
        `
        
        const head = document.createElement('div')
        head.style.cssText = `
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 6px;
          height: 6px;
          background: #f59e0b;
          border-radius: 50%;
          box-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
        `
        
        const body = document.createElement('div')
        body.style.cssText = `
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 10px;
          height: 8px;
          background: #f59e0b;
          border-radius: 0 0 5px 5px;
          box-shadow: 0 0 6px rgba(245, 158, 11, 0.4);
        `
        
        icon.appendChild(head)
        icon.appendChild(body)
        container.appendChild(icon)
      }
    }

    const createIndustrialHexagons = () => {
      for (let i = 0; i < 8; i++) { 
        const hex = document.createElement('div')
        hex.className = 'industrial-hex'
        hex.style.cssText = `
          position: absolute;
          width: 60px;
          height: 60px;
          background: transparent;
          border: 1px solid rgba(34, 197, 94, 0.25);
          transform: rotate(30deg);
          animation: industrialRotate 15s linear infinite;
          left: ${Math.random() * 100}%;
          top: ${Math.random() * 100}%;
          animation-delay: ${Math.random() * 15}s;
        `
        container.appendChild(hex)
      }
    }

    const createMetricBars = () => {
      for (let i = 0; i < 7; i++) { 
        const bar = document.createElement('div')
        bar.className = 'metric-bar'
        bar.style.cssText = `
          position: absolute;
          height: 3px;
          background: linear-gradient(90deg, #ef4444 0%, #f59e0b 33%, #22c55e 66%, #3b82f6 100%);
          border-radius: 2px;
          animation: metricsFlow 6s ease-in-out infinite;
          box-shadow: 0 0 6px rgba(34, 197, 94, 0.3);
          left: ${Math.random() * 100}%;
          top: ${Math.random() * 100}%;
          animation-delay: ${Math.random() * 6}s;
        `
        container.appendChild(bar)
      }
    }

    // Optimized flow lines with fewer elements and longer intervals
    const createEcoFlowLines = () => {
      const interval = setInterval(() => {
        if (!isVisible) return // Skip if not visible
        
        const line = document.createElement('div')
        line.className = 'eco-flow-line'
        line.style.cssText = `
          position: absolute;
          height: 2px;
          background: linear-gradient(90deg, transparent, #22c55e 30%, #3b82f6 70%, transparent);
          animation: ecoDataFlow 5s linear infinite;
          opacity: 0.5;
          top: ${Math.random() * 100}%;
          width: ${Math.random() * 300 + 100}px;
        `
        container.appendChild(line)
        
        setTimeout(() => {
          if (line.parentNode) line.remove()
        }, 5000)
      }, 3000) // Reduced from 4000 to 3000

      intervalsRef.current.push(interval)
      return () => clearInterval(interval)
    }

    // Reduced particle generation
    const createEcoParticles = () => {
      const interval = setInterval(() => {
        if (!isVisible) return // Skip if not visible
        
        const particle = document.createElement('div')
        particle.className = 'eco-particle'
        particle.style.cssText = `
          position: absolute;
          width: 2px;
          height: 2px;
          background: #22c55e;
          border-radius: 50%;
          box-shadow: 0 0 4px #22c55e;
          animation: ecoParticleFloat 12s linear infinite;
          left: ${Math.random() * 100}%;
        `
        container.appendChild(particle)
        
        setTimeout(() => {
          if (particle.parentNode) particle.remove()
        }, 12000)
      }, 2500) // Reduced from 3000 to 2500

      intervalsRef.current.push(interval)
      return () => clearInterval(interval)
    }

    // Initialize all elements
    createResilienceNodes()
    createHumanIcons()
    createIndustrialHexagons()
    createMetricBars()
    createEcoFlowLines()
    createEcoParticles()

    // Throttled mouse interaction
    let ticking = false
    const handleMouseMove = (e: MouseEvent) => {
      if (!ticking) {
        animationFrameRef.current = requestAnimationFrame(() => {
          const mouseX = e.clientX / window.innerWidth
          const mouseY = e.clientY / window.innerHeight
          
          const grid = container.querySelector('.sustainability-grid') as HTMLElement
          if (grid) {
            grid.style.transform = `translate(${mouseX * 8}px, ${mouseY * 8}px)`
          }
          ticking = false
        })
        ticking = true
      }
    }

    container.addEventListener('mousemove', handleMouseMove, { passive: true })

    return () => {
      cleanup()
      container.removeEventListener('mousemove', handleMouseMove)
    }
  }, [isVisible, cleanup])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return (
    <>
      <style>
        {`
          @keyframes sustainabilityPulse {
            0%, 100% { opacity: 0.4; }
            33% { opacity: 0.8; }
            66% { opacity: 0.6; }
          }
          
          @keyframes resilienceFloat {
            0%, 100% { transform: translateY(0px) scale(1); }
            25% { transform: translateY(-15px) scale(1.1); }
            75% { transform: translateY(8px) scale(0.95); }
          }
          
          @keyframes resiliencePulse {
            0%, 100% { transform: scale(1); opacity: 0.4; }
            50% { transform: scale(2); opacity: 0.8; }
          }
          
          @keyframes humanGlow {
            0%, 100% { opacity: 0.6; filter: brightness(1); }
            50% { opacity: 1; filter: brightness(1.3); }
          }
          
          @keyframes ecoDataFlow {
            0% { transform: translateX(-100%); opacity: 0; }
            15% { opacity: 0.7; }
            85% { opacity: 0.7; }
            100% { transform: translateX(100vw); opacity: 0; }
          }
          
          @keyframes industrialRotate {
            0% { transform: rotate(30deg); opacity: 0.3; }
            50% { opacity: 0.7; }
            100% { transform: rotate(390deg); opacity: 0.3; }
          }
          
          @keyframes metricsFlow {
            0%, 100% { width: 50px; opacity: 0.4; filter: blur(0px); }
            50% { width: 200px; opacity: 0.9; filter: blur(1px); }
          }
          
          @keyframes coreAssessment {
            0%, 100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 0.6; }
            33% { transform: translate(-50%, -50%) scale(1.1) rotate(120deg); opacity: 0.9; }
            66% { transform: translate(-50%, -50%) scale(0.95) rotate(240deg); opacity: 0.8; }
          }
          
          @keyframes ecoParticleFloat {
            0% { transform: translateY(100vh) translateX(0px) scale(0); opacity: 0; }
            10% { opacity: 1; transform: translateY(90vh) translateX(20px) scale(1); }
            90% { opacity: 0.8; transform: translateY(10vh) translateX(100px) scale(1.2); }
            100% { transform: translateY(-10px) translateX(150px) scale(0); opacity: 0; }
          }
        `}
      </style>
      
      <div 
        ref={containerRef}
        className={`absolute inset-0 overflow-hidden ${!isVisible ? 'animation-paused' : ''}`}
        style={{
          background: 'linear-gradient(135deg, #0a0f0a 0%, #1a2e1a 20%, #16213e 50%, #2e3a1a 80%, #0f1f23 100%)'
        }}
      >
        {/* Simplified Sustainability Grid */}
        <div 
          className="sustainability-grid absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(34, 197, 94, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(34, 197, 94, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
            animation: 'sustainabilityPulse 8s ease-in-out infinite'
          }}
        />
        
        {/* Simplified Central Assessment Symbol */}
        <div 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          style={{
            width: '100px',
            height: '100px',
            border: '2px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '50%',
            animation: 'coreAssessment 8s ease-in-out infinite'
          }}
        >
          <div 
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            style={{
              width: '60px',
              height: '60px',
              border: '2px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '50%',
              animation: 'coreAssessment 8s ease-in-out infinite reverse'
            }}
          />
        </div>
      </div>
    </>
  )
}

export default AnimatedBackground