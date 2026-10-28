export const SAP_ORDER_URL =
  'https://my301631.s4hana.ondemand.com/ui#MaintenanceOrder-change?MaintenanceOrder=';

export const SAP_MP_URL =
  'https://my301631.s4hana.ondemand.com/ui#MaintenancePlan-schedule?MaintenancePlan=';

function makeWomaUrl(
  plant,
  order
) {
  const p = encodeURIComponent(plant);
  const o = encodeURIComponent(order);
  return `http://prirptapp03v/ReportServer/Pages/ReportViewer.aspx?/CorporateReports/ERP/Maintenance/Work+Order+Material+Availability&rs:Command=Render&Plant=${p}&MaintenanceOrder=${o}`
}
