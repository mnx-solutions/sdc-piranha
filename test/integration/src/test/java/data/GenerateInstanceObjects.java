package data;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.google.gson.Gson;

public class GenerateInstanceObjects {

	private CreateInstanceObject[] cioA;

	static String readFile(String path, Charset encoding) throws IOException {
		byte[] encoded = Files.readAllBytes(Paths.get(path));
		return encoding.decode(ByteBuffer.wrap(encoded)).toString();
	}

	private static Map<String, BigDecimal> licences = new HashMap<String, BigDecimal>();

	public GenerateInstanceObjects() {
		importLicenceData();
		Gson gson = new Gson();
		String iFile = null;
		String pFile = null;
		String ppFile = null;
		try {
			iFile = readFile("./ams-images.txt", StandardCharsets.UTF_8);
			pFile = readFile("./packages.json", StandardCharsets.UTF_8);
			ppFile = readFile("./packagePrices.json", StandardCharsets.UTF_8);
		} catch (IOException e) {
			e.printStackTrace();
		}
		Image[] img = gson.fromJson(iFile, Image[].class);
		Package[] pck = gson.fromJson(pFile, Package[].class);
		PackagePrice[] ppck = gson.fromJson(ppFile, PackagePrice[].class);
		addPricesToPackages(pck, ppck);
		CreateInstanceObject[] instanceObjects = combineImagesAndPackages(img,
				pck);
		addLicenseFees(instanceObjects, licences);
		setCioA(instanceObjects);
	}

	private void addLicenseFees(CreateInstanceObject[] iol,
			Map<String, BigDecimal> li) {
		for (CreateInstanceObject io : iol) {
			if (li.containsKey(io.getImageName())) {
				BigDecimal modifier = li.get(io.getImageName());
				BigDecimal price = new BigDecimal(io.getPrice());
				BigDecimal priceMonth = new BigDecimal(io.getPriceMonth());
				io.setPrice((price.add(modifier)).toString());
				io.setPriceMonth((priceMonth.add(modifier
						.multiply(new BigDecimal("730")))).stripTrailingZeros()
						.toString());
			}
		}
	}

	private static void addPricesToPackages(Package[] pck, PackagePrice[] ppck) {
		for (Package pack : pck) {
			for (PackagePrice price : ppck) {
				if (price.getName().equals(pack.getName())) {
					pack.setPrice(price.getPrice());
					pack.setPriceMonth(price.getPriceMonth());
					pack.setDisplayedName(price.getShort_name());
					break;
				}
			}

		}
	}

	public static CreateInstanceObject[] combineImagesAndPackages(Image[] img,
			Package[] pck) {
		List<CreateInstanceObject> cioL = new ArrayList<CreateInstanceObject>();
		for (Image image : img) {
			int minSize = (image.getRequirements().getMin_ram() != null) ? Integer
					.parseInt(image.getRequirements().getMin_ram()) : 0;

			int maxSize = (image.getRequirements().getMax_ram() != null) ? Integer
					.parseInt(image.getRequirements().getMax_ram()) : 100000000;

			String filter = (image.getType().equals("smartmachine")) ? "-smartos"
					: "-kvm";

			for (Package pack : pck) {
				if (pack.getName().endsWith(filter)
						&& Integer.parseInt(pack.getMemory()) >= minSize
						&& Integer.parseInt(pack.getMemory()) <= maxSize) {
					cioL.add(new CreateInstanceObject(image.getName(), image
							.getVersion(), image.getOs(), image
							.getDescription(), pack.getName(), pack
							.getDisplayedName(), pack.getDescription(), pack
							.getPrice(), pack.getPriceMonth()));
					break;
				}
			}
		}
		return cioL.toArray(new CreateInstanceObject[cioL.size()]);
	}

	public CreateInstanceObject[] getCioA() {
		return cioA;
	}

	public void setCioA(CreateInstanceObject[] cioA) {
		this.cioA = cioA;
	}

	private void importLicenceData() {
		licences.put("stm-500L-10", new BigDecimal("0.108"));
		licences.put("stm-500M-200", new BigDecimal("0.226"));
		licences.put("stm-1000M", new BigDecimal("0.612"));
		licences.put("stm-1000M-SAF", new BigDecimal("1.28"));
		licences.put("stm-1000H", new BigDecimal("0.932"));
		licences.put("stm-2000L", new BigDecimal("1.374"));
		licences.put("stm-2000L-SAF", new BigDecimal("2.362"));
		licences.put("stm-4000L", new BigDecimal("2.586"));
		licences.put("ws2008ent-r2-sp1", new BigDecimal("0.2"));
		licences.put("ws2008std-r2-sp1", new BigDecimal("0.06"));
		licences.put("ws2012std", new BigDecimal("0.06"));
	}

}
