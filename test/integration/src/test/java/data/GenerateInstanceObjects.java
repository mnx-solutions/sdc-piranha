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

import org.json.JSONException;
import org.json.JSONObject;

import com.google.gson.Gson;

/**
 * This class reads data from json files and combines them to
 * CreateInstanceObjects
 */
public class GenerateInstanceObjects {

	private CreateInstanceObject[] cioA;

	/**
	 * @param path
	 *            - file path
	 * @param encoding
	 *            - file encoding
	 * @return returns file as string
	 * @throws IOException
	 */
	static String readFile(String path, Charset encoding) throws IOException {
		byte[] encoded = Files.readAllBytes(Paths.get(path));
		return encoding.decode(ByteBuffer.wrap(encoded)).toString();
	}

	/**
	 * HashMap to hold license price modifiers
	 */
	private static Map<String, BigDecimal> licences = new HashMap<String, BigDecimal>();

	/**
	 * A constructor to generate virtual machine objects Firstly it reads in a
	 * cloudapi imageList json file, then a cloudapi package list file and a
	 * package prices file taken from the portal application.
	 * 
	 * Then the file strings are serialized using the Gson api.
	 * 
	 * Then the prices are added to the package objects.
	 * 
	 * Then the virtual machine objects are combined based on the image
	 * requirements.
	 * 
	 * Then the prices are updated with the license fees.
	 */
	public GenerateInstanceObjects() {
		importLicenceData();
		Gson gson = new Gson();
		String iFile = null;
		String pFile = null;
		String ppFile = null;
		try {
			iFile = readFile(System.getProperty("images", "./images.json"),
					StandardCharsets.UTF_8);
			pFile = readFile(System.getProperty("packages", "./packages.json"),
					StandardCharsets.UTF_8);
			ppFile = readFile(
					System.getProperty("packagePrices", "./apppackages.json"),
					StandardCharsets.UTF_8);
		} catch (IOException e) {
			e.printStackTrace();
		}
		Image[] img = gson.fromJson(iFile, Image[].class);
		Package[] pck = gson.fromJson(pFile, Package[].class);
		ArrayList<PackagePrice> ppck = getPackagePrices(ppFile);
		addPricesToPackages(pck, ppck);
		CreateInstanceObject[] instanceObjects = combineImagesAndPackages(img,
				pck);
		addLicenseFees(instanceObjects, licences);
		setCioA(instanceObjects);
	}

	/**
	 * @param iol
	 *            - instance object list.
	 * @param li
	 *            - license hashmap.
	 * 
	 *            This method updates the instance object list with the license
	 *            prices taken from the license hashmap.
	 */
	private static void addLicenseFees(CreateInstanceObject[] iol,
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

	/**
	 * @param pck
	 *            - Packages list
	 * @param ppck
	 *            - Package prices list
	 * 
	 *            This method updates the packages list with prices and the
	 *            displayed name of the package taken from the package prices
	 *            list.
	 */
	private static void addPricesToPackages(Package[] pck,
			ArrayList<PackagePrice> ppck) {
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

	private static ArrayList<PackagePrice> getPackagePrices(String file) {
		ArrayList<PackagePrice> ppck = new ArrayList<PackagePrice>();
		JSONObject ja;
		try {
			ja = new JSONObject(file);
			String[] names = JSONObject.getNames(ja.getJSONObject("all"));
			for (String name : names) {
				JSONObject pac = ja.getJSONObject("all").getJSONObject(name);
				ppck.add(new PackagePrice(name, pac.getString("price"), pac
						.getString("price_month"), pac.getString("short_name")));
			}
		} catch (JSONException e) {
			e.printStackTrace();
		}
		return ppck;
	}

	/**
	 * @param img
	 *            - Image list
	 * @param pck
	 *            - Package list
	 * @return A array of CreateInstanceObjects
	 * 
	 *         This method combines the image list and package list based on the
	 *         image requirements
	 */
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

	/**
	 * Sets license fees, image name, and license modifier
	 */
	private static void importLicenceData() {
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
