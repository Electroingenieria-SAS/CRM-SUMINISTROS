-- CRM SUMINISTROS V11.40.0
-- Modelo predictivo de fletes construido sobre 749 despachos reales con origen Tuluá
-- (COLVANES, TCC y VELOENVIOS; ene-sep 2026).
-- PRIVACIDAD: esta migración contiene únicamente coeficientes y estadística agregada.
-- No incluye nombres, NIT, teléfonos, direcciones, destinatarios, guías ni documentos de clientes.
begin;

create table if not exists erp_supply.freight_prediction_models(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  model_code text not null,
  model_version text not null,
  origin_city text not null,
  source_start date not null,
  source_end date not null,
  sample_count integer not null check(sample_count>0),
  intercept numeric not null,
  coefficients jsonb not null default '{}'::jsonb,
  calibration jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  feature_schema jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,model_code,model_version)
);

create table if not exists erp_supply.freight_route_reference(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  model_version text not null,
  origin_city text not null,
  carrier text not null,
  destination_city text not null,
  destination_department text not null default '',
  sample_count integer not null check(sample_count>0),
  weight_sample_count integer not null default 0,
  weight_p20 numeric,
  weight_p50 numeric,
  weight_p80 numeric,
  cost_p20 numeric,
  cost_p50 numeric,
  cost_p80 numeric,
  transit_sample_count integer not null default 0,
  transit_p50_days numeric,
  transit_p80_days numeric,
  novelty_sample_count integer not null default 0,
  novelty_rate numeric,
  on_time_sample_count integer not null default 0,
  on_time_rate numeric,
  charge_real_sample_count integer not null default 0,
  charge_to_real_p50 numeric,
  dimensional_uplift_rate numeric,
  source_start date not null,
  source_end date not null,
  source_label text not null default 'TRANSPORTADORAS_ENE_SEP_2026_AGGREGATED',
  created_at timestamptz not null default now(),
  unique(organization_id,model_version,origin_city,carrier,destination_city,destination_department)
);

alter table erp_supply.freight_prediction_models enable row level security;
alter table erp_supply.freight_route_reference enable row level security;
revoke all on table erp_supply.freight_prediction_models from public,anon,authenticated;
revoke all on table erp_supply.freight_route_reference from public,anon,authenticated;

create index if not exists idx_freight_prediction_models_active_v1140
  on erp_supply.freight_prediction_models(organization_id,active,model_version desc);
create index if not exists idx_freight_route_reference_lookup_v1140
  on erp_supply.freight_route_reference(organization_id,model_version,carrier,destination_city,destination_department);

create or replace function erp_supply.freight_norm_v1140(p_value text)
returns text
language sql
immutable
set search_path=pg_catalog
as $$
  select trim(regexp_replace(
    translate(upper(coalesce(p_value,'')),'ÁÉÍÓÚÜÑ','AEIOUUN'),
    '\s+',' ','g'
  ))
$$;
revoke all on function erp_supply.freight_norm_v1140(text) from public,anon,authenticated;

create or replace function erp_supply.freight_weight_band_v1140(p_weight numeric)
returns integer
language sql
immutable
set search_path=pg_catalog
as $$
  select case
    when coalesce(p_weight,0)<=5 then 0
    when p_weight<=10 then 1
    when p_weight<=20 then 2
    when p_weight<=50 then 3
    when p_weight<=100 then 4
    when p_weight<=200 then 5
    when p_weight<=350 then 6
    when p_weight<=500 then 7
    when p_weight<=750 then 8
    when p_weight<=1000 then 9
    else 10
  end
$$;
revoke all on function erp_supply.freight_weight_band_v1140(numeric) from public,anon,authenticated;

delete from erp_supply.freight_prediction_models
where organization_id in(select id from erp_supply.organizations where code='EI')
  and model_code='EI_FREIGHT_RIDGE_WEIGHT';

insert into erp_supply.freight_prediction_models(
  organization_id,model_code,model_version,origin_city,source_start,source_end,sample_count,
  intercept,coefficients,calibration,metrics,feature_schema,active
)
select
  o.id,'EI_FREIGHT_RIDGE_WEIGHT','11.40.0','TULUA','2026-01-06','2026-09-23',749,
  9.630226952455,
  '{"COLVANES:lw":0.2060155935297945,"COLVANES:lw2":0.0015604449764545667,"TCC:lw":-0.035642270538472694,"TCC:lw2":0.02330561264498775,"VELOENVIOS:lw":0.03571217856569031,"VELOENVIOS:lw2":0.02059582222950546,"band=0":0.18464243016681645,"band=1":-0.014013639535568613,"band=10":-0.12043150818476574,"band=2":-0.08548522195013354,"band=3":-0.1083184155926101,"band=4":-0.04256438730551495,"band=5":0.05785459830683544,"band=6":0.08371731896751464,"band=7":0.06246877337963055,"band=8":0.04664970032264018,"band=9":-0.06451964857523418,"carrier=COLVANES":-0.5048325760022395,"carrier=TCC":0.6764764855346636,"carrier=VELOENVIOS":-0.17164390953117295,"dept=":-0.17011214379290257,"dept=ANTIOQUIA":0.08770124937755135,"dept=ATLANTICO":0.10530275739034826,"dept=BOGOTA DC":-0.06961162412847759,"dept=BOLIVAR":-0.05937602010008318,"dept=BOYACA":0.09791807086379284,"dept=CALDAS":0.061253037288662784,"dept=CAUCA":0.08710803139609559,"dept=CESAR":0.014597267088263187,"dept=CHOCO":-0.0004205928602259829,"dept=CORDOBA":0.05856670344307038,"dept=CUNDINAMARCA":0.02254058344973704,"dept=D.C.":0.13823083152511564,"dept=GUAJIRA":0.010178266287946715,"dept=HUILA":0.13797156285204876,"dept=MAGDALENA":0.13652258874159914,"dept=META":0.019394642770279694,"dept=NARINO":0.06255461900807067,"dept=NORTE DE SANTANDER":-0.02686759002045329,"dept=QUINDIO":-0.20735293226588142,"dept=RISARALDA":-0.26468498852541567,"dept=SANTANDER":-0.034019077617086176,"dept=SUCRE":0.01802413021897021,"dept=TOLIMA":0.18962499109693584,"dept=VALLE":-0.1021968342194807,"dept=VALLE DEL CAUCA":-0.3128475292685618,"dest=AGUACHICA":0.024067033365474423,"dest=AMBALEMA":-0.018324160101492157,"dest=APARTADO":-0.004180875141700204,"dest=ARMENIA":-0.1989200827909939,"dest=BARRANCABERMEJA":-0.01851667277066002,"dest=BARRANQUILLA":-0.10797063120851001,"dest=BELLO":-0.06769882066822527,"dest=BOGOTA":-0.07208546189921691,"dest=BUCARAMANGA":0.08144576129654608,"dest=BUENAVENTURA":0.10970323244813458,"dest=BUGA":-0.06925637985075873,"dest=CACERES":0.013802353557719431,"dest=CALI":-0.4272050860276579,"dest=CARTAGENA":-0.031320967184751136,"dest=CARTAGO":-0.13667572635274494,"dest=CAUCASIA":0.010404178986676229,"dest=CERETE":0.007493010681648555,"dest=CHAPARRAL":0.002831304910718679,"dest=CHARALA":0.0775365626194072,"dest=CHINU":0.07135557268669038,"dest=CHIQUINQUIRA":0.030255477285131442,"dest=CUCUTA":-0.01488899293528988,"dest=EL ROSAL":0.14886211701599358,"dest=ESPINAL":-0.0014280187626587346,"dest=FLORIDA":-0.11662350515571558,"dest=FLORIDABLANCA":-0.08197241129048712,"dest=FUNZA":-0.011895022717861251,"dest=GALAPA":0.01183365809884423,"dest=GARZON":0.2379374622278047,"dest=GIRON":-0.06226157857184084,"dest=GRANADA":0.0183338588912754,"dest=GUACHUCAL":0.03593589328623612,"dest=GUATAVITA":0.32363963347912933,"dest=IPIALES":0.050663156937815056,"dest=ITAGUI":-0.03551159343136027,"dest=ITUANGO":0.1454463555177549,"dest=JAMUNDI":0.005146581777880911,"dest=LA DOLORES PALMIRA":0.06402013737542422,"dest=LA DORADA":0.005269207368080815,"dest=LA JAGUA DE IBIRICO":-0.1206944679156564,"dest=LA UNION":-0.012972537580336849,"dest=LA VIRGINIA":-0.20290513720064665,"dest=LORICA":0.023682682765720785,"dest=LOS PATIOS":-0.0209265145327539,"dest=MAICAO":0.010178266287946944,"dest=MANIZALES":-0.049162152971639984,"dest=MARINILLA":-0.011157638281098286,"dest=MARIQUITA":0.20654586505029587,"dest=MEDELLIN":-0.0546544119958006,"dest=MIRANDA":0.2120674216889431,"dest=MONTERIA":-0.07935108836594325,"dest=NEIVA":-0.0999658993757761,"dest=PALMIRA":-0.08980348082797064,"dest=PAMPLONA":0.008947917447552864,"dest=PASTO":-0.024044431216029595,"dest=PEREIRA":-0.06177985132476822,"dest=PIEDECUESTA":-0.11059618407962711,"dest=PLANETA RICA":0.002501391769485635,"dest=PLATO":0.3187198566230818,"dest=POPAYAN":-0.10401934935412654,"dest=PRADERA":-0.0096958436737842,"dest=PUERTO COLOMBIA":0.11679353850805942,"dest=QUIBDO":-0.00042059286022524945,"dest=QUIMBAYA":-0.00843284947488847,"dest=RESTREPO":0.00106078387896709,"dest=SABANALARGA":0.08464619199192784,"dest=SAN GIL":0.045611473335612385,"dest=SAN VICENTE DE CHUCURI":0.015068064899491177,"dest=SAN VICENTE DEL CHUCU":0.01966590694439551,"dest=SANTA CRUZ DE LORICA":0.032885133905491006,"dest=SANTA MARTA":-0.18219726788148577,"dest=SANTA ROSA DE OSOS":0.0454510990701856,"dest=SANTANDER DE QUILICHAO":-0.020940040938765916,"dest=SINCELEJO":0.018024130218971018,"dest=SOGAMOSO":0.06766259357866312,"dest=SOPO":-0.2113926313780295,"dest=SUPIA":0.37873672496504734,"dest=TAMALAMEQUE":0.09403310663199212,"dest=TARAZA":0.04580060176357239,"dest=TENJO":-0.08596884365366714,"dest=TURBACO":-0.028055052915305616,"dest=VALLEDUPAR":0.01719159500646512,"dest=VIJES":0.19373838812218563,"dest=VILLAMARIA":-0.22238236388996874,"dest=YUMBO":-0.14674066571860694,"destlw=AGUACHICA":0.10046511770504464,"destlw=AMBALEMA":0.1253870915732715,"destlw=APARTADO":-0.01732192898626728,"destlw=ARMENIA":-0.018575978115984302,"destlw=BARRANCABERMEJA":-0.04440104210475869,"destlw=BARRANQUILLA":-0.002276780994353629,"destlw=BELLO":-0.23247688393337515,"destlw=BOGOTA":-0.07681001101559416,"destlw=BUCARAMANGA":0.008418750469966515,"destlw=BUENAVENTURA":-0.07823834825614842,"destlw=BUGA":-0.22564397142764342,"destlw=CACERES":0.04549030569317,"destlw=CALI":-0.08897907997316024,"destlw=CARTAGENA":0.01758481000127879,"destlw=CARTAGO":-0.06392453986238192,"destlw=CAUCASIA":0.04832107419874689,"destlw=CERETE":0.031627525026690535,"destlw=CHAPARRAL":0.0196987964724962,"destlw=CHARALA":0.154974279130751,"destlw=CHINU":0.019377088818682223,"destlw=CHIQUINQUIRA":-0.0112656989911957,"destlw=CUCUTA":0.033486868796750224,"destlw=EL ROSAL":-0.07276212038765871,"destlw=ESPINAL":-0.012332770222209204,"destlw=FLORIDA":-0.09024053485319267,"destlw=FLORIDABLANCA":0.03568080331124952,"destlw=FUNZA":-0.03621466356173279,"destlw=GALAPA":-0.06628810663786472,"destlw=GARZON":-0.011473626942515266,"destlw=GIRON":0.03497435666824833,"destlw=GRANADA":0.04957486132846337,"destlw=GUACHUCAL":0.09483287746628752,"destlw=GUATAVITA":0.1609443024764282,"destlw=IPIALES":-0.08619497996465827,"destlw=ITAGUI":-0.11431606840831868,"destlw=ITUANGO":0.1861638018744999,"destlw=JAMUNDI":-0.12633949872240852,"destlw=LA DOLORES PALMIRA":0.11470868736370272,"destlw=LA DORADA":0.0387852649317493,"destlw=LA JAGUA DE IBIRICO":0.10989162050131564,"destlw=LA UNION":-0.042265779779819934,"destlw=LA VIRGINIA":0.04509223980177132,"destlw=LORICA":0.06035484351662478,"destlw=LOS PATIOS":0.06806819117409114,"destlw=MAICAO":0.018237005001755624,"destlw=MANIZALES":-0.0862631290935108,"destlw=MARINILLA":-0.058092716371688426,"destlw=MARIQUITA":-0.012138219370437887,"destlw=MEDELLIN":-0.10932225798189157,"destlw=MIRANDA":0.09392778178941097,"destlw=MONTERIA":0.06583423049760248,"destlw=NEIVA":-0.025517573511362166,"destlw=PALMIRA":-0.13040005951040734,"destlw=PAMPLONA":0.08477412754211607,"destlw=PASTO":-0.0988514304372423,"destlw=PEREIRA":-0.075230359082262,"destlw=PIEDECUESTA":0.045522021382352194,"destlw=PLANETA RICA":0.06234007842668711,"destlw=PLATO":0.22091977000675972,"destlw=POPAYAN":-0.11250553199178376,"destlw=PRADERA":-0.06343153419080372,"destlw=PUERTO COLOMBIA":-0.014568272306355205,"destlw=QUIBDO":-0.032455308915544726,"destlw=QUIMBAYA":-0.027475037679771056,"destlw=RESTREPO":0.006695386533870916,"destlw=SABANALARGA":-0.0028273997429662033,"destlw=SAN GIL":0.06117676053380426,"destlw=SAN VICENTE DE CHUCURI":0.055895544558558774,"destlw=SAN VICENTE DEL CHUCU":0.07693348038909902,"destlw=SANTA CRUZ DE LORICA":0.1071429409298566,"destlw=SANTA MARTA":0.07785308059916154,"destlw=SANTA ROSA DE OSOS":0.14808406852979794,"destlw=SANTANDER DE QUILICHAO":-0.14002832801068404,"destlw=SINCELEJO":0.024135248113264583,"destlw=SOGAMOSO":-0.0021930953317238276,"destlw=SOPO":-0.03244690225089295,"destlw=SUPIA":-0.07515749653069176,"destlw=TAMALAMEQUE":0.2165192295787417,"destlw=TARAZA":0.12732527662317283,"destlw=TENJO":-0.09551295618872371,"destlw=TURBACO":0.006573775826280609,"destlw=VALLEDUPAR":0.045173450716436185,"destlw=VIJES":0.006710858946696253,"destlw=VILLAMARIA":-0.10463856797699367,"destlw=YUMBO":-0.13219358366154135,"lw":0.20608550155034014,"lw2":0.04546187982904021}'::jsonb,
  '{"COLVANES":{"n":161,"p10":0.7585259910325394,"p20":0.8495419857489594,"p50":0.9658714921402497,"p80":1.1036561721994858,"p90":1.1899944741014739},"TCC":{"n":139,"p10":0.7112708252101566,"p20":0.8157738860492811,"p50":0.9911390654645291,"p80":1.429668505161637,"p90":1.6104561225923488},"VELOENVIOS":{"n":71,"p10":0.7754299700937746,"p20":0.8869379442113241,"p50":0.9945457577716418,"p80":1.0569911241304721,"p90":1.109997136021378}}'::jsonb,
  '{"sampleCount":371,"medianAbsolutePercentageError":0.12106009847814918,"within25Pct":70.88948787061994,"within50Pct":92.99191374663073,"maeCop":71179.73516773566,"medianAbsoluteErrorCop":16560.149714997853,"method":"rolling_month_out_of_time_may_sep_2026"}'::jsonb,
  jsonb_build_object(
    'target','TOTAL_FREIGHT_COP',
    'method','RIDGE_LOG_TARGET',
    'alpha',1,
    'features',jsonb_build_array(
      'carrier','destination','department','weightBand','logWeight','logWeightSquared',
      'carrierXLogWeight','carrierXLogWeightSquared','destinationXLogWeight'
    ),
    'materialWeightCoveragePct',100,
    'trainingPrivacy','AGGREGATED_MODEL_NO_PII'
  ),
  true
from erp_supply.organizations o
where o.code='EI'
on conflict(organization_id,model_code,model_version)
do update set
  source_start=excluded.source_start,source_end=excluded.source_end,sample_count=excluded.sample_count,
  intercept=excluded.intercept,coefficients=excluded.coefficients,calibration=excluded.calibration,
  metrics=excluded.metrics,feature_schema=excluded.feature_schema,active=true,updated_at=now();

delete from erp_supply.freight_route_reference
where organization_id in(select id from erp_supply.organizations where code='EI')
  and model_version='11.40.0';

with seed(
  carrier,destination_city,destination_department,
  sample_count,weight_sample_count,weight_p20,weight_p50,weight_p80,
  cost_p20,cost_p50,cost_p80,
  transit_sample_count,transit_p50_days,transit_p80_days,
  novelty_sample_count,novelty_rate,on_time_sample_count,on_time_rate,
  charge_real_sample_count,charge_to_real_p50,dimensional_uplift_rate,
  source_start,source_end
) as(values
('COLVANES','AMBALEMA','TOLIMA',2,2,108,123,138,400220,462650,525080,2,4.5,4.5,2,0,2,1,2,3.382353,0.5,'2026-05-26','2026-07-15'),
('COLVANES','APARTADO','ANTIOQUIA',1,1,62,62,62,109639,109639,109639,1,2,2,1,0,1,1,1,1,0,'2026-03-04','2026-03-04'),
('COLVANES','ARMENIA','QUINDIO',5,5,16.4,42,95.6,27442,46132,120435.6,5,1,1.3,5,0.4,5,0.8,5,1.333333,0.6,'2026-01-06','2026-08-04'),
('COLVANES','BARRANQUILLA','ATLANTICO',14,14,42.4,130.5,288.8,76713,186222,431436.4,14,2,2.9,14,0.357143,14,0.571429,14,1,0.428571,'2026-01-06','2026-08-20'),
('COLVANES','BOGOTA','D.C.',15,15,25.8,164,238.6,64865.6,199094,287721.6,15,2,2,15,0.733333,15,0.866667,15,1,0.466667,'2026-01-06','2026-08-18'),
('COLVANES','BUCARAMANGA','SANTANDER',4,4,362.8,741.5,1157.8,592458.8,1175990.5,1780083.4,4,4.5,5.5,4,0.5,4,0.25,4,1.195652,0.5,'2026-01-20','2026-02-03'),
('COLVANES','BUENAVENTURA','VALLE',3,3,152,158,720.2,150646.2,150822,565929.6,3,1.5,2.4,3,0.666667,3,0.333333,3,2.393939,1,'2026-01-20','2026-09-09'),
('COLVANES','BUGA','VALLE',1,1,25,25,25,22800,22800,22800,1,1,1,1,0,1,1,1,12.5,1,'2026-01-06','2026-01-06'),
('COLVANES','CALI','VALLE',14,14,1,13.5,34.8,8036,15500,26283.6,14,1,2.5,14,0.357143,14,0.571429,14,1,0.357143,'2026-01-06','2026-09-11'),
('COLVANES','CARTAGENA','BOLIVAR',18,18,105.2,414,614.6,185847.4,635953,976551.4,18,2.5,3,18,0.333333,18,0.888889,18,1.145674,0.555556,'2026-01-06','2026-09-21'),
('COLVANES','CARTAGO','VALLE',7,7,40.2,60,78.6,52340,71849,86871.6,7,1,1.9,7,0,7,0.571429,7,1,0.285714,'2026-01-06','2026-08-24'),
('COLVANES','CAUCASIA','ANTIOQUIA',1,1,103,103,103,253831,253831,253831,1,2,2,1,1,1,1,1,1,0,'2026-03-07','2026-03-07'),
('COLVANES','CERETE','CORDOBA',4,4,23.4,25,31,58530.6,63245,73130.6,4,1.75,2,4,0.25,4,1,4,1.095238,0.5,'2026-05-08','2026-09-10'),
('COLVANES','CHAPARRAL','TOLIMA',1,1,1050,1050,1050,1944850,1944850,1944850,1,4,4,1,0,1,0,1,1,0,'2026-05-11','2026-05-11'),
('COLVANES','CHARALA','SANTANDER',8,8,78.8,114.5,122.6,303220,439000,466160,8,5.75,6.5,8,0,8,0,8,1,0.375,'2026-01-22','2026-08-25'),
('COLVANES','CHINU','CORDOBA',8,8,27.2,60,211.4,67560.4,132557.5,440431,8,2.25,3.1,8,0.25,8,0.75,8,1.914149,0.75,'2026-01-08','2026-09-02'),
('COLVANES','CUCUTA','NORTE DE SANTANDER',5,5,339,459,824.2,587854,911604,1409214.2,5,4,4.5,5,0.8,5,0,5,1,0,'2026-05-19','2026-09-17'),
('COLVANES','EL ROSAL','CUNDINAMARCA',4,4,2.2,129.5,629.6,19531,146635.5,669310.8,4,2.75,3.2,4,1,4,0.5,4,1.380965,0.75,'2026-07-15','2026-09-09'),
('COLVANES','ESPINAL','TOLIMA',2,2,269.2,413.5,557.8,482400.2,720375.5,958350.8,2,2,2,2,0.5,2,1,2,1.11236,0.5,'2026-06-22','2026-07-28'),
('COLVANES','FLORIDA','VALLE',2,2,9.6,21,32.4,17424,26715,36006,2,1.25,1.4,2,0.5,2,0.5,2,1.333333,0.5,'2026-03-10','2026-08-21'),
('COLVANES','FLORIDABLANCA','SANTANDER',5,5,117.8,157,180.6,223430.4,304506,332301.4,5,2.5,3.2,5,0.2,5,0.4,5,1.24581,0.8,'2026-01-06','2026-08-06'),
('COLVANES','FUNZA','CUNDINAMARCA',1,1,20,20,20,40900,40900,40900,1,1.5,1.5,1,1,1,1,1,2.5,1,'2026-08-21','2026-08-21'),
('COLVANES','GALAPA','ATLANTICO',5,5,21.2,25,27.4,43367,48400,53795.2,5,1.5,2.3,5,0.2,5,0.8,5,1.041667,0.4,'2026-01-06','2026-08-20'),
('COLVANES','GIRON','SANTANDER',5,5,39.4,53,155.2,68364.8,96871,274247,5,2,2.2,5,0.2,5,0.8,5,1,0,'2026-01-07','2026-06-23'),
('COLVANES','GRANADA','META',5,5,3.6,8,30.8,28010,38135,83332.8,5,3,3.3,5,0.8,5,0.2,5,1,0.4,'2026-02-16','2026-07-16'),
('COLVANES','GUATAVITA','CUNDINAMARCA',1,1,1,1,1,35200,35200,35200,1,9,9,1,0,1,0,1,1,0,'2026-01-07','2026-01-07'),
('COLVANES','IPIALES','NARINO',1,1,21,21,21,39191,39191,39191,1,2,2,1,0,1,1,1,2.333333,1,'2026-07-06','2026-07-06'),
('COLVANES','ITUANGO','ANTIOQUIA',2,2,586,652,718,3364400,3720800,4077200,2,4.5,5.1,2,0,2,1,2,3.012299,1,'2026-04-29','2026-06-23'),
('COLVANES','JAMUNDI','VALLE',4,4,17,38,125.4,23760,38753,96343.2,4,1,1.2,4,0.25,4,0.75,4,1.264671,0.75,'2026-01-06','2026-03-20'),
('COLVANES','LA DOLORES PALMIRA','VALLE',1,1,5,5,5,33885,33885,33885,1,0,0,1,1,1,1,1,1,0,'2026-09-23','2026-09-23'),
('COLVANES','LA DORADA','CALDAS',1,1,1572,1572,1572,3088833,3088833,3088833,1,1.5,1.5,1,0,1,1,1,1.492877,1,'2026-07-17','2026-07-17'),
('COLVANES','LA JAGUA DE IBIRICO','CESAR',5,5,44.8,77,199.2,105167.6,190745,434030.8,5,3,4.1,5,0.4,5,0.8,5,1.138577,0.6,'2026-01-07','2026-08-26'),
('COLVANES','LA UNION','VALLE',2,2,25,25,25,40115,40115,40115,2,1.5,1.8,2,0.5,2,0.5,2,12.5,1,'2026-03-04','2026-03-04'),
('COLVANES','LA VIRGINIA','RISARALDA',5,5,40.4,91,127,51630,112563,141879.8,5,1,1.5,5,0,5,0.6,5,1.259259,0.8,'2026-02-25','2026-06-25'),
('COLVANES','LORICA','CORDOBA',5,5,56.6,60,63,129425,154908,155932.4,5,2.5,3.1,5,0.4,5,0.8,5,1.722222,1,'2026-05-13','2026-09-02'),
('COLVANES','LOS PATIOS','NORTE DE SANTANDER',13,13,92.4,100,200.6,191719.6,251020,433097.4,13,2,2.5,13,0.153846,13,1,13,1,0.076923,'2026-01-21','2026-09-04'),
('COLVANES','MAICAO','GUAJIRA',1,1,5,5,5,28640,28640,28640,1,3.5,3.5,1,1,1,1,1,1,0,'2026-02-19','2026-02-19'),
('COLVANES','MANIZALES','CALDAS',6,6,102,102.5,110,111322,131534.5,136657,6,1,1,6,0,6,1,6,1,0,'2026-01-15','2026-08-26'),
('COLVANES','MARINILLA','ANTIOQUIA',2,2,297.6,336,374.4,393220.8,436353,479485.2,2,2.25,3,2,0.5,2,0.5,2,1,0,'2026-03-03','2026-04-29'),
('COLVANES','MARIQUITA','TOLIMA',2,2,27.2,30.5,33.8,66386.4,72576,78765.6,2,1,1,2,0,2,1,2,2.032609,1,'2026-03-03','2026-07-02'),
('COLVANES','MEDELLIN','ANTIOQUIA',7,7,32,75,417.4,49209.2,103582,371259,7,1.5,1.9,7,0.714286,7,0.285714,7,1.041667,0.428571,'2026-01-06','2026-09-21'),
('COLVANES','MIRANDA','CAUCA',7,7,10,61,277.6,66040,220100,975460,7,2.5,5.5,7,0.142857,7,1,7,2.363636,0.857143,'2026-01-07','2026-06-24'),
('COLVANES','MONTERIA','CORDOBA',18,18,26.2,82,468.8,62199.2,208466,1030005.6,18,2.5,3.3,18,0.666667,18,0.777778,18,1.924158,0.722222,'2026-01-06','2026-09-15'),
('COLVANES','NEIVA','HUILA',2,2,946,1184.5,1423,1337600.8,1662223,1986845.2,2,1.75,2.2,2,0.5,2,0.5,2,1,0,'2026-06-30','2026-07-31'),
('COLVANES','PALMIRA','VALLE',15,15,2,4,25,13761,22800,30392,15,1,1.6,15,0.4,15,0.533333,15,1.176471,0.533333,'2026-01-08','2026-09-03'),
('COLVANES','PAMPLONA','NORTE DE SANTANDER',3,3,115,211,304.6,313690.8,575742,763198.