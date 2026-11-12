INSERT INTO staff (name,email,password_hash,role) VALUES ('Neema Joseph','neema@example.test','disabled','Technician');
INSERT INTO categories (name,description) VALUES
 ('Routers','Routing and gateway equipment'), ('Switches','Managed and unmanaged switches'),
 ('Access Points','Indoor and outdoor wireless'), ('Cables & accessories','Cabling, connectors and accessories'),
 ('Security & CCTV','Network video and surveillance'), ('Services','Installation and configuration');
INSERT INTO brands (name) VALUES ('MikroTik'), ('TP-Link'), ('Omada'), ('Ruijie'), ('Ubiquiti'), ('CSolution');
INSERT INTO products (name,sku,category_id,brand_id,type,unit,cost,price,agent_price,reorder,on_hand,warranty)
SELECT x.name,x.sku,c.id,b.id,x.type,x.unit,x.cost,x.price,x.agent_price,x.reorder,x.stock,x.warranty
FROM (VALUES
 ('MikroTik hEX S','MTK-HEX-S','Routers','MikroTik','Stocked','pcs',125000,180000,165000,5,3,12),
 ('Omada EAP225','OMD-EAP225','Access Points','Omada','Stocked','pcs',140000,210000,195000,6,17,12),
 ('TP-Link TL-SG108','TPL-SG108','Switches','TP-Link','Stocked','pcs',55000,85000,78000,5,4,12),
 ('Ruijie Reyee RG-RAP2200','RG-RAP2200','Access Points','Ruijie','Stocked','pcs',170000,250000,230000,4,10,12),
 ('Cat6 UTP Ethernet cable','CAB-CAT6','Cables & accessories','CSolution','Stocked','m',850,1500,1300,50,32,0),
 ('RJ45 Cat6 connector','RJ45-CAT6','Cables & accessories','CSolution','Stocked','pcs',250,500,450,25,250,0),
 ('UniFi U6 Lite','UBI-U6-LITE','Access Points','Ubiquiti','Stocked','pcs',240000,325000,300000,3,7,12),
 ('TP-Link VIGI C340','TPL-C340','Security & CCTV','TP-Link','Stocked','pcs',105000,155000,145000,3,15,12),
 ('Network installation','SVC-INSTALL','Services','CSolution','Service','job',25000,80000,NULL,0,0,0),
 ('Router configuration','SVC-CONFIG','Services','CSolution','Service','job',10000,45000,NULL,0,0,0)
) AS x(name,sku,category,brand,type,unit,cost,price,agent_price,reorder,stock,warranty)
JOIN categories c ON c.name=x.category JOIN brands b ON b.name=x.brand;
INSERT INTO customers (name,kind,phone,address,code) VALUES
 ('ABC Networks','Business','+255 700 000 101','Mikocheni, Dar es Salaam',NULL),
 ('Musa Technologies','Agent','+255 700 000 102','Sinza, Dar es Salaam','AG-001'),
 ('Amina Msuya','Retail','+255 700 000 103','Kinondoni, Dar es Salaam',NULL),
 ('Kijani Office Group','Business','+255 700 000 104','Masaki, Dar es Salaam',NULL),
 ('Vertex Digital','Agent','+255 700 000 105','Mbezi, Dar es Salaam','AG-002');
INSERT INTO suppliers (name,phone,address) VALUES
 ('East Africa Network Supply','+255 700 000 301','Dar es Salaam'),
 ('Connect Distribution','+255 700 000 302','Arusha');

DO $$
DECLARE
  row_data record;
  person customers%ROWTYPE;
  item products%ROWTYPE;
  admin uuid := (SELECT id FROM staff WHERE role='Admin' ORDER BY created_at LIMIT 1);
  tech uuid := (SELECT id FROM staff WHERE email='neema@example.test');
  sale_id uuid;
  sale_ref text;
  invoice_ref text;
  sale_total numeric;
  sale_cost numeric;
  sale_time timestamptz;
BEGIN
  FOR row_data IN SELECT * FROM (VALUES
    (23,'Amina Msuya','TPL-C340',3,0,0),
    (18,'Kijani Office Group','MTK-HEX-S',3,1,0),
    (13,'Vertex Digital','RG-RAP2200',4,0,0),
    (10,'ABC Networks','TPL-SG108',3,0,0),
    (6,'Kijani Office Group','OMD-EAP225',3,1,0),
    (5,'Amina Msuya','TPL-C340',2,0,0),
    (4,'Vertex Digital','UBI-U6-LITE',3,0,0),
    (3,'ABC Networks','RG-RAP2200',3,1,0),
    (2,'Amina Msuya','TPL-SG108',2,0,0),
    (2,'Vertex Digital','UBI-U6-LITE',2,0,2),
    (1,'Kijani Office Group','OMD-EAP225',5,1,1),
    (0,'Musa Technologies','MTK-HEX-S',4,0,0),
    (0,'ABC Networks','OMD-EAP225',2,1,0)
  ) AS r(days_back,customer,sku,qty,service,partial)
  LOOP
    SELECT * INTO person FROM customers WHERE name=row_data.customer;
    SELECT * INTO item FROM products WHERE sku=row_data.sku;
    sale_id := gen_random_uuid();
    invoice_ref := 'INV-' || nextval('invoice_number');
    sale_total := item.price*row_data.qty + row_data.service*80000;
    sale_cost := item.cost*row_data.qty + row_data.service*25000;
    sale_time := (now() - make_interval(days => row_data.days_back, mins => row_data.qty * 2));
    INSERT INTO sales (id,request_id,invoice,customer_id,customer_name,customer_address,customer_phone,buyer_type,cashier_id,kind,subtotal,total,cost,due_date,created_at)
      VALUES (sale_id,gen_random_uuid(),invoice_ref,person.id,person.name,person.address,person.phone,CASE WHEN person.kind='Agent' THEN 'Agent' ELSE 'Customer' END,admin,
        CASE WHEN row_data.service=1 THEN 'Equipment + installation' ELSE 'Equipment' END,
        sale_total,sale_total,sale_cost,(sale_time AT TIME ZONE 'Africa/Dar_es_Salaam')::date+14,sale_time)
      RETURNING number INTO sale_ref;
    INSERT INTO sale_items (sale_id,product_id,name,quantity,price,cost,type,unit)
      VALUES (sale_id,item.id,item.name,row_data.qty,item.price,item.cost,item.type,item.unit);
    INSERT INTO stock_movements (product_id,kind,delta,reference,staff_id,created_at)
      VALUES (item.id,'Sale',-row_data.qty,sale_ref,admin,sale_time);
    IF row_data.service=1 THEN
      INSERT INTO sale_items (sale_id,product_id,name,quantity,price,cost,type,unit)
        SELECT sale_id,id,name,1,price,cost,type,unit FROM products WHERE sku='SVC-INSTALL';
    END IF;
    IF row_data.partial<2 THEN
      INSERT INTO payments (request_id,sale_id,amount,method,staff_id,created_at)
        VALUES (gen_random_uuid(),sale_id,CASE WHEN row_data.partial=1 THEN 400000 ELSE sale_total END,'Mobile money',admin,sale_time);
    END IF;
    IF row_data.days_back=0 AND row_data.service=1 THEN
      INSERT INTO installations (title,customer_id,sale_id,technician_id,location,scheduled,status)
        VALUES ('Office Wi-Fi setup',person.id,sale_id,tech,person.address,current_date+1,'Scheduled');
    END IF;
  END LOOP;
  INSERT INTO stock_movements (product_id,kind,delta,reference,staff_id,created_at)
    SELECT p.id,'Opening stock',p.on_hand-COALESCE(sum(m.delta),0),'Initial inventory',admin,now()-interval '25 days'
    FROM products p LEFT JOIN stock_movements m ON m.product_id=p.id
    WHERE p.type='Stocked' GROUP BY p.id;
  INSERT INTO installations (title,customer_id,technician_id,location,scheduled,status)
    SELECT 'Router configuration',id,tech,address,current_date,'In progress' FROM customers WHERE name='Musa Technologies';
  INSERT INTO expenses (description,amount,incurred) VALUES ('Local deliveries',35000,current_date);
END $$;
