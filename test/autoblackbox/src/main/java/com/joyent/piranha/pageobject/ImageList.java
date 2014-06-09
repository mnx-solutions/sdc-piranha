package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import com.joyent.piranha.PropertyHolder;
import org.openqa.selenium.By;

import java.io.IOException;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class ImageList extends AbstractPageObject {
    public static final String TITLE = "Images";
    public static final String IMAGE_ROW = "[data-ng-repeat=\"object in objects | orderBy:order | filter:matchesFilter\"]";
    public static final String IMAGE_GRID_CELL = "[data-ng-repeat=\"prop in props | orderBy:'sequence' | filter:{active:true}\"]";

    @Override
    String getTitle() {
        return TITLE;
    }

    public boolean isImageDisplayed(String imageName) {
        return  $("#grid-instances").$(byText(imageName)).isDisplayed();
    }

    public void checkImageParams(String imageName, String osType, String datacenter, String imageVersion) {
        SelenideElement row = getRowByText(IMAGE_ROW, imageName);
        row.$(byText(osType)).shouldBe(visible);
        row.$(byText(datacenter)).shouldBe(visible);
        row.$(byText(imageVersion)).shouldBe(visible);
    }

    public CreateInstanceManual clickCreateInstance(String imageName){
       SelenideElement row = getRowByText(IMAGE_ROW, imageName);
        row.$("button").click();
        return page(CreateInstanceManual.class);
    }

    public String getImageUUID(String imageName) {
        addGridColumn("UUID");
        int lines = $("#grid-instances tr").$$(IMAGE_GRID_CELL).size();
        SelenideElement table = $("#grid-instances");
        SelenideElement row = table.$(By.xpath("//td[contains(., " + imageName + ")]/.."));
        SelenideElement cell = row.$(IMAGE_GRID_CELL, lines - 1);
        return cell.getText();
    }

    public void deleteImageByName(String imageName) throws IOException {
        String imageId = getImageUUID(imageName);
        ProcessBuilder cloudApiAuth = new ProcessBuilder("ssh", "-i", PropertyHolder.getPrivateKeyPath(), "root@192.168.115.248", "curl", "-kis", "http://10.0.0.15/images/" + imageId, "-XDELETE");
        cloudApiAuth.start();
    }

}
