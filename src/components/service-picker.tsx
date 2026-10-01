import { useEffect, useState } from "react";
import { ChevronRight, Plus, Search, X } from "lucide-react";
import {
  searchServices,
  serviceCatalog,
  serviceIcon,
  type ServiceTemplate,
} from "../service-catalog";

export function ServicePicker({
  close,
  select,
}: {
  close: () => void;
  select: (service: ServiceTemplate | null) => void;
}) {
  const [query, setQuery] = useState("");
  const services = searchServices(query);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);
  return (
    <div className="modal-overlay" onClick={close}>
      <section
        className="modal service-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">CHOOSE A SERVICE</span>
            <h2 id="service-picker-title">选择订阅服务</h2>
            <p>找到你的服务，再填写价格和续费信息。</p>
          </div>
          <button type="button" onClick={close} aria-label="关闭">
            <X />
          </button>
        </div>
        <div className="service-picker-body">
          <label className="service-search">
            <Search size={18} />
            <input
              autoFocus
              aria-label="搜索订阅服务"
              placeholder="搜索名称、官网或分类"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label="清空搜索"
                onClick={() => setQuery("")}
              >
                <X size={16} />
              </button>
            )}
          </label>
          <button
            type="button"
            className="service-custom"
            onClick={() => select(null)}
          >
            <span className="service-custom-icon">
              <Plus size={20} />
            </span>
            <span>
              <b>自定义订阅</b>
              <small>没有找到？从空白表单开始</small>
            </span>
            <ChevronRight size={18} />
          </button>
          <div className="service-result-count" role="status">
            {query
              ? `找到 ${services.length} 项服务`
              : `${serviceCatalog.length} 项常用服务`}
          </div>
          <div className="service-results">
            {services.map((service) => (
              <button
                type="button"
                className="service-option"
                key={service.name}
                onClick={() => select(service)}
              >
                <img src={serviceIcon(service)} alt="" width="40" height="40" />
                <span>
                  <b>{service.name}</b>
                  <small>{service.group}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
            {!services.length && (
              <div className="service-no-results">
                <Search size={26} />
                <b>没有找到对应服务</b>
                <p>试试其他关键词，或点击上方“自定义订阅”。</p>
              </div>
            )}
          </div>
          <small className="service-attribution">
            图标来自 Dashboard Icons
          </small>
        </div>
      </section>
    </div>
  );
}
