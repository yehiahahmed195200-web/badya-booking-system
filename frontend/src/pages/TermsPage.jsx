import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { termsData, TERMS_VERSION, TERMS_EFFECTIVE_DATE, TERMS_LAST_UPDATED } from "../config/termsData";
import { analyticsService } from "../services/analyticsService";
import { useLanguage } from "../context/LanguageContext";
import "./TermsPage.css";

export default function TermsPage() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // Tab state
  const [activeTab, setActiveTab] = useState("general_rules");
  // Search query state
  const [searchQuery, setSearchQuery] = useState("");
  // Expanded violatons state
  const [expandedViolations, setExpandedViolations] = useState({});

  // Reference to sections for scroll into view
  const containerRef = useRef(null);

  // Initialize analytics session
  useEffect(() => {
    analyticsService.init();
    return () => {
      analyticsService.endSession();
    };
  }, []);

  // Sync tab option from URL Hash
  useEffect(() => {
    const hash = location.hash ? location.hash.replace("#", "") : "";
    if (hash) {
      // Find which category contains this item ID, or if the hash is the category ID itself
      const matchedCategory = termsData.find(
        (cat) => cat.id === hash || cat.items.some((item) => item.id === hash)
      );
      if (matchedCategory) {
        setActiveTab(matchedCategory.id);
        analyticsService.trackTabChange(matchedCategory.id);
        
        // If it's an item ID, expand it and scroll to it
        if (matchedCategory.id === "violations" && hash !== "violations") {
          setExpandedViolations((prev) => ({ ...prev, [hash]: true }));
        }

        // Delay scroll slightly to allow tab render transition
        setTimeout(() => {
          const element = document.getElementById(hash);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.focus();
          }
        }, 150);
      }
    }
  }, [location.hash]);

  // Tab switching handler
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    analyticsService.trackTabChange(tabId);
  };

  // Search input handler with telemetry debounce
  const searchTimeoutRef = useRef(null);
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      analyticsService.trackSearch(val);
    }, 800);
  };

  // Memoized search filtering for high performance
  const filteredData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return termsData;

    return termsData.map((category) => {
      const matchedItems = category.items.filter((item) => {
        const titleText = (item.title ? item.title[language] : item.name ? item.name[language] : "").toLowerCase();
        const contentText = (item.content ? item.content[language] : item.description ? item.description[language] : "").toLowerCase();
        const keywordsMatch = item.keywords ? item.keywords.some(kw => kw.toLowerCase().includes(query)) : false;
        
        // Also search within violation timelines
        let timelineMatch = false;
        if (item.timeline) {
          const timelineKeys = ["first", "second", "repeated"];
          timelineMatch = timelineKeys.some(key => {
            const step = item.timeline[key];
            return (
              step.title[language].toLowerCase().includes(query) ||
              step.penalty[language].toLowerCase().includes(query)
            );
          });
        }

        // Also search within sports rules lists
        let sportsRulesMatch = false;
        if (item.rules && item.rules[language]) {
          sportsRulesMatch = item.rules[language].some(rule => rule.toLowerCase().includes(query));
        }

        return titleText.includes(query) || contentText.includes(query) || keywordsMatch || timelineMatch || sportsRulesMatch;
      });

      return {
        ...category,
        items: matchedItems
      };
    });
  }, [searchQuery, language]);

  // Check if search returned any results
  const hasSearchResults = useMemo(() => {
    return filteredData.some((category) => category.items.length > 0);
  }, [filteredData]);

  // Toggle violation accordion
  const toggleViolation = (id) => {
    setExpandedViolations((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Keyboard navigation inside accordions (Space/Enter trigger)
  const handleAccordionKeyDown = (e, id) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleViolation(id);
    }
  };

  // Trigger print view
  const handlePrint = () => {
    window.print();
  };

  // Localized dictionary keys fallback
  const getDict = (en, ar) => (language === "ar" ? ar : en);

  // Active Category object for filtered selection
  const activeCategoryData = useMemo(() => {
    return filteredData.find((cat) => cat.id === activeTab) || null;
  }, [filteredData, activeTab]);

  return (
    <div className="terms-page-wrapper">
      <div className="terms-container" ref={containerRef}>
        
        {/* Header */}
        <header className="terms-header">
          <button className="terms-back-btn" onClick={() => navigate(-1)} aria-label="Go Back">
            <span>{language === "ar" ? "←" : "←"}</span>
            {getDict("Go Back", "رجوع")}
          </button>
          <h1>{getDict("Terms & Conditions", "الشروط والأحكام")}</h1>
          <div className="terms-metadata">
            <span>{getDict(`Version ${TERMS_VERSION}`, `الإصدار ${TERMS_VERSION}`)}</span>
            <span>{getDict(`Effective: ${TERMS_EFFECTIVE_DATE}`, `ساري من: ${TERMS_EFFECTIVE_DATE}`)}</span>
          </div>
        </header>

        {/* Search & Actions Panel */}
        <section className="terms-controls">
          <div className="terms-search-wrapper">
            <span className="terms-search-icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              className="terms-search-input"
              placeholder={getDict("Search rules, sports, keywords...", "ابحث في القوانين، الرياضات، الكلمات المفتاحية...")}
              value={searchQuery}
              onChange={handleSearchChange}
              aria-label="Search terms and conditions"
            />
          </div>
          <button className="terms-print-btn" onClick={handlePrint} aria-label="Print Terms as PDF">
            <span aria-hidden="true">🖨️</span>
            {getDict("Print / Save PDF", "طباعة / حفظ كـ PDF")}
          </button>
        </section>

        {/* Tabs Menu - Only show if not searching (search shows matched sections across categories) */}
        {!searchQuery && (
          <nav className="terms-tabs" role="tablist" aria-label="Terms Categories">
            {termsData.map((category) => (
              <button
                key={category.id}
                role="tab"
                aria-selected={activeTab === category.id}
                aria-controls={`panel-${category.id}`}
                id={`tab-${category.id}`}
                className={`terms-tab-btn ${activeTab === category.id ? "active" : ""}`}
                onClick={() => handleTabChange(category.id)}
              >
                <span>{category.icon}</span>
                {category.category[language]}
              </button>
            ))}
          </nav>
        )}

        {/* Content Renderers */}
        <main className="terms-content-area">
          {!hasSearchResults ? (
            <div className="terms-empty-state">
              <h3>{getDict("No matches found", "لم يتم العثور على نتائج")}</h3>
              <p>{getDict("Try adjusting your search terms or keywords.", "يرجى تجربة كلمات بحث مختلفة.")}</p>
            </div>
          ) : searchQuery ? (
            /* Search Results Mode: render all categories that have matching items */
            <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
              {filteredData.map((category) => {
                if (category.items.length === 0) return null;
                return (
                  <div key={category.id} className="terms-panel">
                    <h2>{category.icon} {category.category[language]}</h2>
                    {renderCategoryContent(category)}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Standard Tabs Mode */
            activeCategoryData && (
              <div
                className="terms-panel"
                role="tabpanel"
                id={`panel-${activeTab}`}
                aria-labelledby={`tab-${activeTab}`}
              >
                <h2>{activeCategoryData.icon} {activeCategoryData.category[language]}</h2>
                {renderCategoryContent(activeCategoryData)}
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );

  // Nested renderer to display content based on category type
  function renderCategoryContent(category) {
    switch (category.id) {
      case "general_rules":
      case "system_rules":
        return (
          <div className="general-rules-list">
            {category.items.map((item) => (
              <div 
                key={item.id} 
                className="rule-item" 
                id={item.id}
                tabIndex="0"
              >
                <div className="rule-item-title">
                  <span>📌</span> {item.title[language]}
                </div>
                <p className="rule-item-content">{item.content[language]}</p>
              </div>
            ))}
          </div>
        );

      case "violations":
        return (
          <div className="violations-list">
            {category.items.map((item) => {
              const isExpanded = !!expandedViolations[item.id];
              return (
                <div 
                  key={item.id} 
                  className={`violation-card ${isExpanded ? "expanded" : ""}`}
                  id={item.id}
                >
                  <button
                    className="violation-card-header"
                    aria-expanded={isExpanded}
                    onClick={() => toggleViolation(item.id)}
                    onKeyDown={(e) => handleAccordionKeyDown(e, item.id)}
                  >
                    <div className="violation-header-main">
                      <h3 className="violation-title">❌ {item.title[language]}</h3>
                      <p className="violation-desc">{item.description[language]}</p>
                    </div>
                    <span className="violation-arrow" aria-hidden="true">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="violation-card-content">
                      <div className="penalty-timeline">
                        <div className="penalty-timeline-line" />
                        
                        <div className="penalty-step warning">
                          <div className="penalty-badge" aria-label="First Offense Badge">🟨</div>
                          <div className="penalty-step-title">{item.timeline.first.title[language]}</div>
                          <p className="penalty-step-text">{item.timeline.first.penalty[language]}</p>
                        </div>

                        <div className="penalty-step suspension">
                          <div className="penalty-badge" aria-label="Second Offense Badge">🟧</div>
                          <div className="penalty-step-title">{item.timeline.second.title[language]}</div>
                          <p className="penalty-step-text">{item.timeline.second.penalty[language]}</p>
                        </div>

                        <div className="penalty-step severe">
                          <div className="penalty-badge" aria-label="Repeated Offense Badge">🟥</div>
                          <div className="penalty-step-title">{item.timeline.repeated.title[language]}</div>
                          <p className="penalty-step-text">{item.timeline.repeated.penalty[language]}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );

      case "sports_rules":
        return (
          <div className="sports-grid">
            {category.items.map((sport) => (
              <div 
                key={sport.id} 
                className="sport-card" 
                id={sport.id}
                tabIndex="0"
              >
                <div className="sport-card-head">
                  <span className="sport-card-icon" aria-hidden="true">{sport.icon}</span>
                  <h3 className="sport-card-name">{sport.name[language]}</h3>
                </div>

                <div className="sport-card-meta">
                  <div className="sport-meta-row">
                    <span>{getDict("Slot Duration:", "فترة اللعب:")}</span>
                    <strong>{sport.duration} {getDict("minutes", "دقيقة")}</strong>
                  </div>
                  <div className="sport-meta-row">
                    <span>{getDict("Players allowed:", "عدد اللاعبين:")}</span>
                    <strong>{sport.minPlayers}–{sport.maxPlayers}</strong>
                  </div>
                </div>

                <h4 className="sport-card-rules-title">{getDict("System Validation:", "فحص التحقق للسيستم:")}</h4>
                <ul className="sport-rules-list">
                  {sport.rules[language].map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );

      case "notices":
        return (
          <div className="notices-grid">
            {category.items.map((notice) => (
              <div 
                key={notice.id} 
                className="notice-card" 
                id={notice.id}
                tabIndex="0"
              >
                <h3>
                  <span>📢</span> {notice.title[language]}
                </h3>
                <p>{notice.content[language]}</p>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  }
}
