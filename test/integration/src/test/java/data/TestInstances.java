package data;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.Writer;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.nio.ByteBuffer;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

import com.google.gson.Gson;

public class TestInstances {

	public static void writeCreateInstanceObjectsToFile(
			CreateInstanceObject[] cioA) {
		Writer writer = null;
		Gson gson = new Gson();
		try {
			writer = new BufferedWriter(new OutputStreamWriter(
					new FileOutputStream("output.json"), "utf-8"));
			writer.write(gson.toJson(cioA));
		} catch (IOException ex) {
			// report
		} finally {
			try {
				writer.close();
			} catch (Exception ex) {
			}
		}
	}

	static String readFile(String path, Charset encoding) throws IOException {
		byte[] encoded = Files.readAllBytes(Paths.get(path));
		return encoding.decode(ByteBuffer.wrap(encoded)).toString();
	}

	public static Image getImageByName(Image[] img, String name) {
		Image r = null;
		for (Image image : img) {
			if (image.getName().equals(name)) {
				r = image;
			}
		}
		return r;
	}

	public static Package[] getPackagesByOs(Package[] pck, String f) {
		List<Package> l = new ArrayList<Package>();
		for (Package pack : pck) {
			if (pack.getName().endsWith(f)) {
				l.add(pack);
			}
		}
		return l.toArray(new Package[l.size()]);
	}

	public static Package[] getPackagesForOs(Image img, Package[] pck) {
		List<Package> l = new ArrayList<Package>();
		String type = img.getType();
		int minSize = (img.getRequirements().getMin_ram() != null) ? Integer
				.parseInt(img.getRequirements().getMin_ram()) : 0;
		String filter = (type.equals("smartmachine")) ? "-smartos" : "-kvm";
		for (Package pack : pck) {
			if (pack.getName().endsWith(filter)
					&& Integer.parseInt(pack.getMemory()) >= minSize) {
				l.add(pack);
			}
		}
		return l.toArray(new Package[l.size()]);
	}

	public static Image[] getImagesByType(Image[] img, String f) {
		List<Image> l = new ArrayList<Image>();
		for (Image image : img) {
			if (image.getType().equals(f)) {
				l.add(image);
			}
		}
		return l.toArray(new Image[l.size()]);
	}
}
